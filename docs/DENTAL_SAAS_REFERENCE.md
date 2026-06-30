# Dental-SaaS (ClinicSync) — Full Architecture Reference

This document is an extremely detailed description of the **dental-saas** project (a multi-clinic
WhatsApp automation SaaS called *ClinicSync*). FacultySync is modeled directly on it. Use this as
the blueprint: every pattern here has a one-to-one analogue in FacultySync (clinic → office,
patient → student, appointment → booking, doctor → professor, service → meeting type, WhatsApp →
Voice/SMS).

---

## 1. What dental-saas is

A SaaS for Romanian dental clinics. One Next.js codebase serves many clinics, separated by
`clinic_id`. It provides:
- A **public booking page** per clinic (`/book/[clinicId]`).
- Automated **WhatsApp** messaging: booking confirmations, 24h + morning reminders, review
  requests, cancellation notices, owner alerts.
- A **clinic dashboard** (appointments calendar, patients, doctors, services, schedules, settings).
- A **super-admin** area to create clinics and approve self-service registration requests.
- **Google Calendar** two-way sync per doctor (busy-block import + event creation).

UI language is Romanian throughout. Times are handled in `Europe/Bucharest`.

---

## 2. Tech stack (exact)

- **Next.js 14.2.x** (App Router, TypeScript), React 18.
- **Supabase**: `@supabase/supabase-js` + `@supabase/ssr` for cookie-aware auth.
- **Twilio** (`twilio` v5) — note: in this codebase Twilio is mostly a stored config value;
  the actual message *sending* is fanned out to **n8n webhooks** (see §7).
- **Vapi** — the voice agent for ClinicSync runs on Vapi and is configured in the Vapi dashboard,
  **not in this repo** (so no voice/TwiML code appears here). Vapi handles telephony + STT + LLM +
  TTS and reaches the backend through tool-call webhooks. FacultySync reuses this exact approach.
- **Tailwind CSS v4**, Radix UI primitives, lucide-react icons, framer-motion, sonner (toasts),
  react-hook-form + zod, FullCalendar (dashboard calendar).
- **nodemailer** (Gmail SMTP) for transactional email (invites etc.).
- **googleapis** for Google Calendar OAuth + sync.
- Deployed on **Vercel**. No test framework configured. Scripts: `dev`, `build`, `start`, `lint`.

---

## 3. The three Supabase clients (IMPORTANT pattern — copy this exactly)

The project deliberately splits Supabase access into three clients by trust level. FacultySync
should reuse this verbatim.

**`lib/supabase.ts` — admin (service role, bypasses RLS). Server-only.**
```ts
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
// Bypasses RLS. NEVER import in a client component.
export const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
```

**`lib/supabase-server.ts` — cookie-aware server client (anon key, respects RLS).** Used in
Server Components and user-facing routes. Reads/writes cookies via `next/headers`.
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* called from a Server Component — can't set cookies, fine */ }
        },
    }})
}
```

**`lib/supabase-browser.ts` — browser client (anon key, RLS).** For `'use client'` components.
30-day cookie maxAge.

**Rule of thumb:** webhooks / cron / public API routes that must bypass RLS use `adminSupabase`;
anything acting *as the logged-in user* uses the server client.

---

## 4. Auth & multi-tenancy

**`lib/auth.ts`** exposes `getAuthContext()`, wrapped in React `cache()` so layout + page dedupe
to a single DB hit per request. It:
1. `supabase.auth.getUser()` (validates JWT against Supabase auth server — not `getSession()`).
2. Loads the matching `staff_profiles` row (`id, clinic_id, full_name, role, is_active`).
3. Returns `null` if no user, no profile, or `is_active === false`.

```ts
export type StaffProfile = {
  id: string; clinic_id: string; full_name: string
  role: 'owner' | 'receptionist' | 'doctor'; is_active: boolean
}
```

**Multi-tenancy rule:** the user's `clinic_id` comes from their `staff_profiles` row, and every
query is scoped to it. Public/booking/webhook routes take `clinic_id` as an explicit parameter and
validate it (and often an `api_key`) before trusting it. There is no cross-clinic data path.

---

## 5. Middleware (`middleware.ts`) — auth gate + rate limiting

Single Edge middleware that runs on almost every path (matcher excludes static assets):

- **In-memory sliding-window rate limiter** per IP per route prefix (state per Edge instance;
  doc-noted that Upstash Redis would be needed for strict cross-instance limits):
  - `/api/auth/register-request` → 5 / 10 min
  - `/api/booking` → 15 / min
  - `/api/cancel` → 10 / min
- **Public path allowlist**: exact (`/`) + prefix list (`/login`, `/book`, `/api/booking`,
  `/api/cancel`, `/api/availability`, `/api/public-doctors`, `/api/send-reminders`,
  `/api/send-reviews`, OAuth callback, `/doctor-onboarding`, privacy page, …).
- Everything else: validates the Supabase user via `getUser()`; redirects to `/login` if absent.

FacultySync analogue: the **Vapi tool webhooks** (`/api/vapi/*`) and the cron route must be public
(Vapi and the scheduler call them unauthenticated at the network level) — but secure them with the
**Vapi webhook secret** and the **cron secret** respectively, exactly as dental-saas secures its
public routes with `api_key` / `x-cron-secret`.

---

## 6. Database schema (inferred from all queries)

UUID PKs, `clinic_id` foreign key everywhere. Tables actually referenced in code:

**clinics** — the tenant. Columns seen: `id, name, owner_whatsapp, google_review_link,
twilio_number, api_key, google_connected`.

**appointments** — the core record:
`id, clinic_id, patient_name, patient_phone, service, appointment_time, end_time, doctor_id,
duration_minutes, patient_id, source ('website'|…), gdpr_accepted_at, reminder_24h_sent (bool),
reminder_2h_sent (bool), review_sent (bool), cancelled (bool), cancel_token (hex string),
gcal_event_id`.

**patients** — `id, clinic_id, full_name, phone`. Upserted on conflict `(clinic_id, phone)`.

**doctors** — `id, clinic_id, google_calendar_id` (+ name etc.).

**services** — `id, clinic_id, name, duration_minutes`. Duration is always resolved server-side
from this table, never trusted from the client.

**doctor_schedules** — `id, clinic_id, doctor_id, day_of_week (0=Mon … 6=Sun), start_time,
end_time` (`HH:MM:SS`). Absence of rows = "no schedule configured" (no restriction); presence of
some rows but none for a given day = day off.

**doctor_services** — join table (which doctor offers which service).

**google_calendar_blocks** — `id, doctor_id, start_time, end_time` — busy intervals imported from
Google Calendar, treated as unavailable.

**staff_profiles** — `id, clinic_id, full_name, role, is_active` (the auth/identity table).

**invitations** — `id, clinic_id, email, role, token, invited_by`. Owner/staff onboarding.

**clinic_registration_requests** — `id, clinic_name, owner_name, owner_email, owner_phone,
status ('pending'|'approved'|'rejected')`. Self-service signup; no password stored.

---

## 7. Messaging: Twilio config + n8n fan-out (KEY INSIGHT)

Although Twilio is the "channel", the code does **not** call the Twilio SDK to send WhatsApp
messages. Instead `lib/n8n-notify.ts` POSTs a JSON payload to per-message-type **n8n webhook URLs**
(env vars), and n8n actually delivers the WhatsApp message via Twilio. Each helper is a thin
`fetch` wrapper that no-ops if its webhook env var is unset:

- `sendBookingConfirmation(phone, {patientName, clinicName, service, formattedTime})`
- `sendOwnerNewBookingAlert(...)`
- `sendCancellationNotice(...)` / `sendOwnerCancellationAlert(...)`
- `sendReminderDayBefore(... cancelLink)` / `sendReminderMorning(...)`
- `sendReviewRequest(phone, {patientName, clinicName, reviewLink})`
- `sendBookingApproved(...)` / `sendBookingDeclined(... reason?)`

Env vars: `N8N_WEBHOOK_BOOKING_CONFIRMATION`, `N8N_WEBHOOK_OWNER_ALERT`,
`N8N_WEBHOOK_CANCELLATION`, `N8N_WEBHOOK_OWNER_CANCEL_ALERT`, `N8N_WEBHOOK_REMINDER_24H`,
`N8N_WEBHOOK_REMINDER_MORNING`, `N8N_WEBHOOK_REVIEW_REQUEST`, `N8N_WEBHOOK_BOOKING_APPROVED`,
`N8N_WEBHOOK_BOOKING_DECLINED`.

> **For FacultySync:** keep this exact indirection — a `lib/sms-notify.ts` that fans out to **n8n**
> webhooks for outbound SMS (confirmations, reminders, owner alerts, feedback requests), identical
> to dental-saas. The live *conversation* is handled entirely by **Vapi** (Vapi owns telephony +
> STT + LLM + TTS), so there is no TwiML and no inline call-scripting to write — the app only
> exposes the Vapi tool webhooks (§8 analogue) and these async n8n senders. Copy the helper-module
> shape (`sendX(phone, {...})`, no-op if unconfigured, wrapped in try/catch) — every send site in
> dental-saas wraps the call in `try {} catch {}` so a messaging failure never breaks the booking.

Email (`lib/email.ts`) uses nodemailer over Gmail SMTP (`smtp.gmail.com:587` STARTTLS),
`GMAIL_USER` / `GMAIL_APP_PASSWORD`. Used for Supabase invite emails etc.

---

## 8. Public booking flow — `POST /api/booking` (study this closely)

This is the most important route to port. Sequence:

1. Parse body; normalize phone via `lib/format.ts → normalizePhone()` (Romanian E.164).
2. Validate required fields (`clinic_id, patient_name, patient_phone, service, appointment_time`).
3. Load clinic by `clinic_id` with `adminSupabase`; 404 if missing.
4. **Auth via `api_key`**: body `api_key` must equal `clinic.api_key`, else 401. (The public
   booking page injects it server-side; external callers like n8n must supply it.)
5. **Resolve duration server-side** from `services` (never trust client duration).
6. **Upsert patient** on conflict `(clinic_id, phone)`, get `patient_id`.
7. **Validate `doctor_id`** belongs to the clinic; fetch its `google_calendar_id`.
8. **Conflict checks** when a doctor is assigned:
   - Overlap against `google_calendar_blocks` (`start < end AND end > start`).
   - Overlap against existing non-cancelled `appointments` in a ±window, resolving each existing
     appt's duration from its row or the services map. Returns **409** on any overlap.
9. **Insert appointment** with computed `end_time`, `source: 'website'`, `gdpr_accepted_at`.
10. Format time in `ro-RO` / `Europe/Bucharest`.
11. Fire-and-forget: `sendBookingConfirmation` (patient) + `sendOwnerNewBookingAlert` (owner),
    each in its own `try/catch`.
12. Fire-and-forget: create **Google Calendar event** if the doctor has a calendar and the clinic
    is `google_connected`; store `gcal_event_id`.
13. Return `{ success, appointment_id }` (201).

**FacultySync analogue:** the **`POST /api/vapi/book`** tool webhook does steps 5–11 against
`bookings` (resolve `meeting_type` duration from `meeting_types`, upsert `students` on
`(office_id, student_id_number)`, conflict-check against `office_hours` + existing bookings,
insert, fire SMS confirmation via n8n). Vapi extracts the args from the call and invokes this
endpoint; `office_id` is resolved from the dialed number in the Vapi payload. The `api_key` check
becomes the **Vapi webhook-secret** check. No Google Calendar needed unless you want it.

---

## 9. Availability algorithm — `GET /api/availability` (the algorithmic core)

Given `clinic_id`, `date` (`YYYY-MM-DD`), optional `doctor_id`, optional `duration`:

1. Determine the doctor's working hours for that weekday from `doctor_schedules`
   (weekday computed at **noon Bucharest** to dodge DST edge cases; `(getDay()+6)%7` → Mon=0).
   - No row for the day but other rows exist → `dayOff: true`.
   - No schedule rows at all → unrestricted.
2. Build the full-day UTC window from Bucharest local midnight.
3. Fetch non-cancelled `appointments` for the day (+ doctor), and the `services` duration map.
4. Build **booked ranges** = each appointment's `[start, start+duration)`, plus
   `google_calendar_blocks` overlapping the day.
5. Walk the day in **30-min slots**; mark a slot "blocked" if it's outside working hours, if
   `slotEnd` exceeds schedule end, or if `[slot, slot+requestedDuration)` overlaps any booked range.
6. Return `{ booked: string[] /* "HH:MM" */, workingHours: {start,end} | null, dayOff? }`.

This is duration-aware (a 60-min service blocks more slots than a 30-min one). Port it almost
verbatim for FacultySync office hours — the voice agent calls this internally to offer slots, and
the dashboard uses it to render availability.

---

## 10. Cancellation by opaque token — `/api/cancel` + `/app/c/[token]`

- The 24h reminder generates a random `cancel_token` (`randomBytes(16).hex`, 32 chars), stores it
  on the appointment, and includes a `/c/{token}` link in the WhatsApp reminder.
- `GET /api/cancel?token=…` looks the appointment up **only by token** (never by raw UUID — that
  would be an IDOR), and returns a small self-contained HTML confirm page (patient data is
  `escapeHtml`-escaped to prevent stored XSS). Guards: already-cancelled, past appointment.
- `POST /api/cancel` `{token}` sets `cancelled: true`, then sends `sendCancellationNotice`
  (patient) + `sendOwnerCancellationAlert` (owner).

**FacultySync analogue:** a student cancelling *by voice* is identified by `student_id_number`
(the agent reads back the matching future booking and confirms), while an SMS cancel link can reuse
the exact token pattern. Keep the IDOR-safe "look up only by opaque token" rule.

---

## 11. Cron jobs — reminders & reviews (cron-secret-protected)

Both `POST /api/send-reminders` and `POST /api/send-reviews` are guarded by a **constant-time**
comparison of the `x-cron-secret` header against `CRON_SECRET` (`crypto.timingSafeEqual`, with a
length check first). They're invoked by an external scheduler.

**send-reminders** branches on the current Bucharest hour:
- Morning (07:00–11:59): finds **today's** non-cancelled appts with `reminder_2h_sent = false`,
  sends `sendReminderMorning`, sets `reminder_2h_sent = true`.
- Otherwise (afternoon): finds **tomorrow's** appts with `reminder_24h_sent = false`, generates a
  `cancel_token`, sends `sendReminderDayBefore` with the cancel link, sets `reminder_24h_sent`.
- Each appt processed in its own try/catch; returns `{ sent }`.

**send-reviews:** finds appts that finished ~2–4h ago with `review_sent = false` and a clinic
`google_review_link`, sends `sendReviewRequest`, sets `review_sent = true`.

**FacultySync analogue:** one cron-secured route that, per Bucharest hour, sends 24h / morning
reminder **SMS or outbound calls** for upcoming bookings, flipping `reminder_24h_sent` /
`reminder_morning_sent`. Optional post-meeting feedback request mirrors send-reviews. Copy the
constant-time secret check verbatim.

---

## 12. Admin & onboarding flows

- **Self-service signup:** `POST /api/auth/register-request` inserts a `clinic_registration_requests`
  row (no password ever stored), de-duped by `owner_email` in `('pending','approved')`.
- **Super-admin** (`user.email === SUPER_ADMIN_EMAIL`) approves a request, which calls
  `POST /api/admin/create-clinic`: creates the `clinics` row, creates an `invitations` row for the
  owner, and sends a Supabase **invite email** (`auth.admin.inviteUserByEmail`) with a
  `redirectTo` carrying the invite token. On any failure it rolls back the created rows.
- **Invite acceptance** (`/accept-invite`, `/auth/callback`) lets the user set a password and
  creates their `staff_profiles` row bound to the clinic.
- **Doctor onboarding** wizard (`/doctor-onboarding`) sets up schedules/services after invite.

FacultySync analogue: `office_registration_requests` → super-admin approves → `create-office`
(office + owner invitation + invite email) → professor sets password & `staff_profiles` row →
onboarding wizard configures office hours, meeting types, FAQ, greeting, and the Twilio number.

---

## 13. Helpers worth copying (`lib/format.ts`)

- `normalizePhone(raw)` → Romanian E.164 (`07xx`→`+407xx`, `0040…`→`+40…`, `40…`→`+40…`,
  bare→`+40…`). **Reuse as-is** for student phones.
- `formatRON`, Romanian `Intl.DateTimeFormat` helpers (`formatDateFull/Short/Month/Time/Weekday`),
  `greetingFor(date)` (Bună dimineața/ziua/seara), `initials`, and date math
  (`startOfDay/endOfDay/addDays/startOfWeek/startOfMonth/endOfMonth/sameDay`).
- Everything is `Europe/Bucharest`-aware and `ro-RO`-formatted. Keep the same locale discipline.

---

## 14. Folder structure (App Router, route groups)

```
app/
  (admin)/admin/...            # super-admin: list/create clinics, approve registrations
  (dashboard)/                 # clinic staff app (auth-gated by middleware + layout)
    dashboard/                 # calendar overview (FullCalendar)
    programari/                # appointments (tabs)
    pacienti/                  # patients CRUD
    doctori/ program/          # doctors + schedules
    servicii/                  # services
    setari/                    # settings, team, Google Calendar connect
    onboarding/
  book/[clinicId]/             # PUBLIC booking page (form, date/time picker, doctor panel)
  c/[token]/                   # cancel-by-token short link
  api/
    booking/ availability/ cancel/            # public booking surface
    appointments/ patients/ doctors/ services/ program/ staff/   # dashboard CRUD
    send-reminders/ send-reviews/             # cron (x-cron-secret)
    admin/create-clinic/ admin/approve-registration/[id]/ ...     # super-admin
    auth/register-request/ auth/accept-invite/ auth/google-calendar/...
    public-doctors/ pending-count/ clinic/ invitations/
  auth/callback/  login, register, forgot-password, reset-password
lib/    components/    middleware.ts
```

FacultySync mirrors this, swapping the public `book/[clinicId]` web form for **Vapi tool webhooks**
(`api/vapi/check-availability`, `api/vapi/book`, `api/vapi/cancel`, `api/vapi/faq`) — students
arrive by phone and Vapi calls these endpoints during the conversation. The dashboard, admin,
onboarding, cron, and helper layers map across almost unchanged. (An optional `book/[officeId]`
web booking page can still be added later as a non-voice fallback.)

---

## 15. Cross-cutting conventions to preserve

- **Multi-tenant or nothing.** No clinic/office-specific branches in code; per-tenant data lives in
  the DB. Every query filters by the tenant id.
- **Server resolves authority data** (durations, prices, schedules) — never trust the client.
- **Messaging is best-effort**: every send is wrapped in try/catch so it can't fail the core write.
- **Times in `Europe/Bucharest`, text in `ro-RO`.**
- **Idempotency flags** on records (`reminder_*_sent`, `review_sent`, `cancelled`) drive the cron
  jobs and prevent double-sends.
- **Opaque tokens, not raw IDs**, for any unauthenticated mutation link (anti-IDOR).
- **Constant-time secret comparison** for cron auth.
- **Service-role client server-side only.**
