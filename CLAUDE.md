# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FacultySync — Multi-Tenant Voice Agent for University Offices

## Project Purpose
SaaS platform that gives every university professor / faculty office an AI **voice agent**
reachable on a normal phone number. Students call it 24/7 and the agent can:

1. **Book office-hours / consultation slots** — collects student name, student ID, and topic,
   checks availability, books the slot, and sends an SMS/email confirmation.
2. **Cancel or reschedule** — the student calls back, identifies themselves by student ID,
   and the agent finds and cancels/moves their booking, freeing the slot.
3. **Answer FAQs** — short, configured answers ("When is the exam?", "What's the retake
   policy?", "Where is your office?") read from the office's config.

One codebase serves all professors/offices via `office_id`. This is the direct analogue of
the dental-saas project's `clinic_id` multi-tenancy. See `docs/DENTAL_SAAS_REFERENCE.md` for
the full architecture this project is modeled on.

## Origin / Design Basis
This project is intentionally a near-copy of the architecture of **dental-saas** (ClinicSync),
a multi-clinic WhatsApp automation platform. We keep the **same stack and the same providers**;
the only fundamental change is the communication channel:

| dental-saas (ClinicSync)        | FacultySync                                   |
| ------------------------------- | --------------------------------------------- |
| Twilio **WhatsApp** messaging   | Twilio **Voice** (inbound + outbound calls)   |
| Clinic = tenant (`clinic_id`)   | Office/Professor = tenant (`office_id`)        |
| Patient books appointment       | Student books office-hours slot                |
| Doctors + services + schedules  | Professor(s) + meeting types + office hours    |
| WhatsApp confirmations/reminders| Voice + SMS confirmations/reminders           |
| Google review request           | (optional) post-meeting feedback request       |

Read `docs/DENTAL_SAAS_REFERENCE.md` before building — it documents the exact patterns
(Supabase client split, multi-tenant rules, cron-secured reminder jobs, cancel-by-token flow,
availability algorithm, middleware/rate-limiting) that we are reusing here.

## Stack (identical to dental-saas)
- Next.js 14 (App Router, TypeScript)
- Supabase (Postgres database + Auth)
- Twilio — **Voice API** (TwiML webhooks + `<Gather input="speech">` for STT), plus SMS
- Tailwind CSS
- Deployed on Vercel
- nodemailer (Gmail SMTP) for transactional email — same as dental-saas
- (optional) n8n webhooks for outbound messaging fan-out — same pattern as dental-saas

## Voice Architecture (the one real new piece)
Twilio Voice works exactly like the dental-saas webhooks: Twilio POSTs to our Next.js API
routes, and we respond with **TwiML** (XML) instead of JSON.

- Inbound call hits `/api/voice/incoming` → we return TwiML that `<Gather input="speech">`s
  the caller's intent and POSTs the transcript to the next route.
- Each step (`/api/voice/intent`, `/api/voice/collect-id`, `/api/voice/confirm`, …) reads the
  speech result, mutates Supabase, and returns the next TwiML `<Say>`/`<Gather>`.
- Start with Twilio's built-in `<Gather input="speech">` speech recognition (no extra provider,
  stays faithful to the dental-saas "Twilio-only" stack). Romanian language code: `ro-RO`.
- All voice prompts are in **Romanian** (`<Say language="ro-RO">`), matching dental-saas's UX.
- Outbound reminder calls / SMS are triggered by a cron-secured route, exactly like
  dental-saas's `send-reminders`.

> Keep call state in the database keyed by the Twilio `CallSid`, NOT in memory — webhook calls
> are stateless and may hit different serverless instances.

## Key Architecture Rule
NEVER build office-specific or professor-specific workflows. Everything is multi-tenant.
Every query filters by `office_id`. Per-office config (greeting, FAQ answers, office hours,
twilio number, meeting types) lives in the database, never in code.

## Database Tables (proposed — mirrors dental-saas)
- **offices** (≙ clinics): `id, name, professor_name, office_phone, twilio_number, greeting,
  feedback_link, api_key, created_at`
- **students** (≙ patients): `id, office_id, full_name, student_id_number, phone, created_at`
  — unique on `(office_id, student_id_number)`
- **bookings** (≙ appointments): `id, office_id, student_name, student_id_number, student_phone,
  meeting_type, topic, slot_time, end_time, duration_minutes, student_id (fk), source,
  reminder_24h_sent, reminder_morning_sent, feedback_sent, cancelled, cancel_token, created_at`
- **meeting_types** (≙ services): `id, office_id, name, duration_minutes`
- **office_hours** (≙ doctor_schedules): `id, office_id, day_of_week (0=Mon…6=Sun), start_time,
  end_time`
- **faqs** (new): `id, office_id, question_keywords, answer` — for the FAQ intent
- **staff_profiles**: `id, office_id, full_name, role ('owner'|'assistant'), is_active`
- **invitations**: `id, office_id, email, role, token, invited_by`
- **office_registration_requests** (≙ clinic_registration_requests): `id, office_name,
  professor_name, owner_email, owner_phone, status, created_at`

## Environment Variables (mirrors dental-saas)
```
# Supabase
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Twilio (Voice + SMS)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER          # the voice number students call

# App
NEXT_PUBLIC_BASE_URL
CRON_SECRET                  # guards /api/send-reminders (x-cron-secret header)
SUPER_ADMIN_EMAIL

# Email (optional, same as dental-saas)
GMAIL_USER
GMAIL_APP_PASSWORD
```

## Build Order (recommended)
1. Scaffold Next.js 14 + TS + Tailwind, add Supabase client split (see reference doc).
2. Create the Supabase schema above. Seed one office + one professor + office hours + meeting types.
3. Build the **availability** logic first (port `app/api/availability` — it's the algorithmic core).
4. Build the **voice booking flow** (`/api/voice/*` TwiML routes) end to end for ONE office.
5. Add **cancel-by-ID / cancel-by-token** flow.
6. Add the **cron reminder** route (outbound SMS/call), cron-secured.
7. Add **FAQ** intent (easy once booking works).
8. Build the **professor dashboard** (upcoming bookings, block slots, edit FAQ) — port the
   dental-saas dashboard patterns.

## Rules (same discipline as dental-saas)
- Always confirm each step works before moving to the next.
- Never hardcode office-specific or professor-specific data anywhere in the code.
- Every Supabase query filters by `office_id`.
- All confirmations (voice + SMS) must include: office/professor name, student name,
  meeting type, and slot time.
- Use the **service-role** Supabase client only in server routes / webhooks; never import it
  into client components.
- Validate Twilio webhook signatures in production (X-Twilio-Signature) before trusting input.

## Commands
- `npm run dev` — start local server
- `npm run build` — production build
