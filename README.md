# FacultySync

A multi-tenant **Vapi voice agent** for university professor offices. Students
call a phone number; Vapi runs the spoken conversation and calls this app's
`/api/vapi/*` tool webhooks to **book** office-hours slots, **cancel** them, and
answer **FAQs**. Everything is multi-tenant by `office_id` — there is no
office-specific logic in code; per-office config lives in the database.

Modeled directly on the **dental-saas (ClinicSync)** architecture — see
[`CLAUDE.md`](CLAUDE.md) and [`docs/DENTAL_SAAS_REFERENCE.md`](docs/DENTAL_SAAS_REFERENCE.md).

## Stack
Next.js 14 (App Router, TS) · Supabase (Postgres + Auth) · **Vapi** (voice) ·
**Twilio** (number + SMS) · **n8n** (SMS fan-out) · Tailwind · Vercel.

## Architecture at a glance
- **Vapi owns the call** (telephony + STT + LLM + TTS). No voice code lives here.
  The assistant is configured in the Vapi dashboard — see
  [`docs/VAPI_ASSISTANT.md`](docs/VAPI_ASSISTANT.md) for the system prompt + tool JSON.
- The app exposes thin **tool webhooks** the assistant calls mid-conversation:
  - `POST /api/vapi/check-availability` → free slots for a date/meeting type
  - `POST /api/vapi/book` → writes a booking, fires an SMS confirmation
  - `POST /api/vapi/cancel` → cancels the student's soonest upcoming booking
  - `POST /api/vapi/faq` → configured answer from the `faqs` table
  Each is secured by the **Vapi webhook secret** (`x-vapi-secret`) and resolves
  `office_id` from the dialed Twilio number (or an assistant-metadata hint).
- **Three Supabase clients** by trust level (`lib/supabase.ts` admin/service-role,
  `lib/supabase-server.ts` cookie-aware, `lib/supabase-browser.ts`).
- **Availability** (`lib/availability.ts`) is the duration-aware algorithmic core,
  ported from dental-saas; the webhooks and dashboard both use it.
- **Reminders**: `POST /api/send-reminders` (cron-secured, `x-cron-secret`) fans
  out 24h / morning reminder SMS and post-meeting feedback via **n8n**.
- **Cancel-by-token**: `/c/[token]` + `/api/cancel` — IDOR-safe opaque-token link
  included in the 24h reminder.
- **Professor dashboard** (`/dashboard`): upcoming bookings, block intervals,
  edit FAQs. Auth-gated by `middleware.ts` + `getAuthContext()`.

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Supabase project**, then in the SQL editor run, in order:
   - [`supabase/schema.sql`](supabase/schema.sql) — all tables + RLS.
   - [`supabase/seed.sql`](supabase/seed.sql) — one demo office (id
     `11111111-1111-1111-1111-111111111111`), professor, office hours, meeting
     types, FAQs.

3. **Env**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in Supabase keys (Settings > API), `VAPI_WEBHOOK_SECRET`, `CRON_SECRET`,
   Twilio number, and any n8n webhook URLs. The n8n URLs are optional — each SMS
   helper no-ops if its variable is unset, so booking still works without them.

4. **Create the professor's dashboard login**
   - Supabase > Authentication > Add user (email + password).
   - Link them to the office (run in SQL editor, using the new user's UUID):
     ```sql
     insert into public.staff_profiles (id, office_id, full_name, role, is_active)
     values ('<AUTH_USER_UUID>', '11111111-1111-1111-1111-111111111111',
             'Prof. dr. Andrei Popescu', 'owner', true);
     ```

5. **Run**
   ```bash
   npm run dev      # http://localhost:3000  (dashboard at /dashboard)
   npm run build    # production build
   ```

## Testing the webhooks without a phone call
The webhooks expect a Vapi-shaped body and the secret header. Example
(`office_id` hint avoids needing the dialed-number lookup):

```bash
curl -X POST http://localhost:3000/api/vapi/check-availability \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: $VAPI_WEBHOOK_SECRET" \
  -d '{"message":{"toolCallList":[{"id":"t1","name":"check_availability",
       "arguments":{"office_id":"11111111-1111-1111-1111-111111111111",
       "date":"2026-07-06","meeting_type":"Consultație ore de birou"}}]}}'
```

`book`, `cancel`, and `faq` follow the same shape (see
[`docs/VAPI_ASSISTANT.md`](docs/VAPI_ASSISTANT.md) for each tool's arguments).

Trigger reminders manually:
```bash
curl -X POST http://localhost:3000/api/send-reminders -H "x-cron-secret: $CRON_SECRET"
```

## Deploy
Push to Vercel, set all env vars, and schedule `POST /api/send-reminders` with the
`x-cron-secret` header (Vercel Cron or any scheduler) a few times daily. Point
your Vapi assistant's tool/server URLs at `https://YOUR-APP/api/vapi/*` and set
its server-URL secret to `VAPI_WEBHOOK_SECRET`. See
[`docs/VAPI_ASSISTANT.md`](docs/VAPI_ASSISTANT.md).

## Multi-tenancy rules (do not break)
- Every query filters by `office_id`. No office/professor-specific branches in code.
- Server resolves authority data (meeting durations, office hours) — never trust the client.
- Service-role client is server-only; never imported into client components.
- Validate the Vapi webhook secret on every tool route; constant-time cron secret check.
- Times in `Europe/Bucharest`, text in `ro-RO`.
