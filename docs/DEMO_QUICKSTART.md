# Demo Quickstart (2 services, ~30 min)

The fastest way to demo FacultySync to your professor. **No Twilio, no phone
number, no n8n, no cron** — you test the agent with Vapi's in-dashboard web call,
which hits the exact same webhooks. Confirmations are spoken by the agent on the
call, so SMS isn't needed.

You need: **Supabase** + **Vapi** + a public URL for your local app (`ngrok`).

## 1. Supabase (~10 min)
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Settings → API → copy: Project URL, `anon` key, `service_role` key.

## 2. Env (~2 min)
```bash
cp .env.local.example .env.local
```
Fill only these (leave everything else blank):
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
VAPI_WEBHOOK_SECRET=pick-any-random-string
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 3. Run the app + expose it (~3 min)
```bash
npm install
npm run dev            # http://localhost:3000
```
In a second terminal, expose it so Vapi can reach your webhooks:
```bash
npx ngrok http 3000    # copy the https URL, e.g. https://ab12.ngrok-free.app
```

## 4. Vapi assistant (~10 min)
1. In the Vapi dashboard, create an assistant.
2. Model: GPT-4o, temperature ~0.3. Voice: a Romanian (`ro-RO`) voice.
3. System prompt: paste from `docs/VAPI_ASSISTANT.md`.
4. Add the 4 function tools from `docs/VAPI_ASSISTANT.md`. Set each tool's
   `server.url` to your **ngrok** URL + the path, e.g.
   `https://ab12.ngrok-free.app/api/vapi/book`.
5. Because there's no phone number to resolve the office from, give the assistant
   the office id directly: set assistant **Metadata** to
   `{ "office_id": "11111111-1111-1111-1111-111111111111" }`
   (the seeded demo office). The webhooks read this hint.
6. Set the server secret (Server Messages → Secret, sent as `x-vapi-secret`) to the
   same `VAPI_WEBHOOK_SECRET` you put in `.env.local`.

## 5. Demo it
Click **"Talk to Assistant"** in Vapi and speak (in Romanian):
- *"Aș vrea o programare la orele de birou luni."* → agent offers slots.
- Give a name + matricul number + topic → agent books it.
- *"Vreau să anulez programarea, matricol 12345."* → agent cancels it.
- *"Când este examenul?"* → agent answers from the seeded FAQ.

Open `http://localhost:3000/dashboard` to show the professor the bookings landing
in real time. (Dashboard login: Supabase → Authentication → Add user, then run the
`insert into staff_profiles …` snippet from the README with that user's UUID.)

## Sanity check before the demo (no voice needed)
```bash
curl -X POST http://localhost:3000/api/vapi/check-availability \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: YOUR_SECRET" \
  -d '{"message":{"toolCallList":[{"id":"t1","name":"check_availability",
       "arguments":{"office_id":"11111111-1111-1111-1111-111111111111",
       "date":"2026-07-06","meeting_type":"Consultație ore de birou"}}]}}'
```
A JSON response with free slots = your webhook + Supabase are wired correctly.

## If you later want a real phone number
Attach a number in Vapi (Vapi can issue one directly, or import a Twilio number),
set `offices.twilio_number` to match it exactly (E.164), and drop the metadata hint
— the webhook will resolve the office from the dialed number instead.
