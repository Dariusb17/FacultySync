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
a multi-clinic clinic-automation platform. We keep the **same stack and the same providers**.
ClinicSync's voice agent is built on **Vapi** (the voice-AI orchestrator), with **n8n** for
outbound messaging and **Twilio** providing the phone number — FacultySync uses the exact same
trio. The only conceptual change is the domain (clinics → offices):

| dental-saas (ClinicSync)        | FacultySync                                   |
| ------------------------------- | --------------------------------------------- |
| Vapi voice agent + WhatsApp/SMS | Vapi voice agent (same)                        |
| Clinic = tenant (`clinic_id`)   | Office/Professor = tenant (`office_id`)        |
| Patient books appointment       | Student books office-hours slot                |
| Doctors + services + schedules  | Professor(s) + meeting types + office hours    |
| Confirmations/reminders via n8n | Confirmations/reminders via n8n (same)         |
| Google review request           | (optional) post-meeting feedback request       |

Read `docs/DENTAL_SAAS_REFERENCE.md` before building — it documents the exact patterns
(Supabase client split, multi-tenant rules, cron-secured reminder jobs, cancel-by-token flow,
availability algorithm, middleware/rate-limiting) that we are reusing here.

## Stack (identical to dental-saas)
- Next.js 14 (App Router, TypeScript)
- Supabase (Postgres database + Auth)
- **Vapi** — the voice-AI agent (telephony + STT + LLM + TTS orchestration). The assistant is
  configured in the Vapi dashboard, not in this repo; it reaches the app through **tool/function
  webhooks**.
- **Twilio** — provides the phone number Vapi dials through, plus outbound SMS.
- **n8n** — outbound messaging fan-out (confirmation/reminder SMS), same pattern as dental-saas.
- Tailwind CSS
- Deployed on Vercel
- nodemailer (Gmail SMTP) for transactional email — same as dental-saas

## Voice Architecture (Vapi — same as ClinicSync)
We do NOT hand-script the call. Vapi owns the entire spoken conversation (telephony, speech-to-
text, the LLM dialogue, text-to-speech). The app's only job is to expose **tool endpoints** that
Vapi's assistant calls mid-conversation to read/write Supabase. This is the same setup ClinicSync
uses — Vapi for voice is configured outside the codebase, so there is no voice code in the
dental-saas repo (only the booking API + the n8n messaging layer are in-repo).

- Vapi assistant config (system prompt, Romanian voice, model, tool definitions) lives in the
  **Vapi dashboard**, not in git. Keep a copy of the prompt + tool JSON in `docs/` for reference.
- The assistant calls these **tool webhooks** (plain JSON in/out, NOT TwiML):
  - `POST /api/vapi/check-availability` — `{ office_id, date, meeting_type }` → free slots
  - `POST /api/vapi/book` — `{ office_id, student_name, student_id, topic, slot }` → writes booking
  - `POST /api/vapi/cancel` — `{ office_id, student_id }` → finds & cancels their future booking
  - `POST /api/vapi/faq` — `{ office_id, question }` → configured answer from the `faqs` table
- **Multi-tenancy:** resolve `office_id` from the dialed number / assistant metadata that Vapi
  includes in the webhook payload — exactly how dental-saas keys a clinic by its `twilio_number`.
  One assistant, per-office context resolved at call time.
- These endpoints are thin wrappers around the SAME availability algorithm, booking-insert flow,
  and cancel logic documented in `docs/DENTAL_SAAS_REFERENCE.md`. Vapi replaces the "front door";
  the core stays identical.
- **Secure the webhooks**: verify Vapi's shared secret / server auth header on every tool call
  before trusting input (the analogue of dental-saas's `api_key` check on `/api/booking`).
- Outbound reminder/confirmation SMS are triggered by a cron-secured route → n8n, exactly like
  dental-saas's `send-reminders`.

> Vapi maintains conversation state itself, so there's no per-turn DB state to manage. Each tool
> webhook is stateless: it receives the args Vapi extracted and returns a result the assistant
> speaks back. (Alternative wiring: point Vapi tools at n8n instead of the app — documented in
> the reference doc. Default here is Vapi → Next.js routes, so the app owns the booking logic.)

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

# Vapi (voice agent — configured in the Vapi dashboard)
VAPI_API_KEY                 # server/private key for any REST calls to Vapi
VAPI_WEBHOOK_SECRET          # shared secret to verify inbound tool-call webhooks

# Twilio (phone number Vapi dials through + outbound SMS)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER          # the number students call (attached to the Vapi assistant)

# n8n (outbound SMS fan-out — same pattern as dental-saas)
N8N_WEBHOOK_BOOKING_CONFIRMATION
N8N_WEBHOOK_REMINDER_24H
N8N_WEBHOOK_REMINDER_MORNING
N8N_WEBHOOK_OWNER_ALERT
N8N_WEBHOOK_FEEDBACK_REQUEST

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
4. Build the **Vapi tool webhooks** (`/api/vapi/check-availability` + `/api/vapi/book`) and wire
   them to a Vapi assistant; get one office booking end to end over a real call.
5. Add the **cancel** tool (`/api/vapi/cancel`, by student ID) + SMS cancel-by-token link.
6. Add the **cron reminder** route (outbound SMS via n8n), cron-secured.
7. Add the **FAQ** tool (`/api/vapi/faq`, easy once booking works).
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
- Validate the Vapi webhook secret on every tool-call route before trusting input (the analogue
  of dental-saas's `api_key` check on `/api/booking`).

## Commands
- `npm run dev` — start local server
- `npm run build` — production build
