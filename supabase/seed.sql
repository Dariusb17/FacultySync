-- FacultySync seed — one office, one professor, office hours, meeting types, FAQs.
-- Run AFTER schema.sql. Uses a fixed office id so you can reference it in tests.

-- Fixed demo office id (handy for curl/Vapi testing).
-- 11111111-1111-1111-1111-111111111111
insert into public.offices (id, name, professor_name, office_phone, twilio_number, greeting, feedback_link, api_key)
values (
  '11111111-1111-1111-1111-111111111111',
  'Catedra de Informatică — Cabinet A12',
  'Prof. dr. Andrei Popescu',
  '+40212345678',
  '+40312345678',                       -- the Twilio number students call (resolves this office)
  'Bună ziua! Ați sunat la cabinetul profesorului Popescu. Cu ce vă pot ajuta?',
  'https://forms.gle/exemplu-feedback',
  'demo-office-api-key'
)
on conflict (id) do nothing;

-- Meeting types (≙ services). Duration is always resolved from here server-side.
insert into public.meeting_types (office_id, name, duration_minutes) values
  ('11111111-1111-1111-1111-111111111111', 'Consultație ore de birou', 15),
  ('11111111-1111-1111-1111-111111111111', 'Discuție proiect / licență', 30),
  ('11111111-1111-1111-1111-111111111111', 'Contestație notă', 15)
on conflict do nothing;

-- Office hours (≙ doctor_schedules). day_of_week: 0=Mon … 6=Sun.
-- Mon/Wed 10:00-13:00, Tue 14:00-16:00, Thu 09:00-11:00.
insert into public.office_hours (office_id, day_of_week, start_time, end_time) values
  ('11111111-1111-1111-1111-111111111111', 0, '10:00', '13:00'),
  ('11111111-1111-1111-1111-111111111111', 2, '10:00', '13:00'),
  ('11111111-1111-1111-1111-111111111111', 1, '14:00', '16:00'),
  ('11111111-1111-1111-1111-111111111111', 3, '09:00', '11:00')
on conflict do nothing;

-- FAQs — matched by keywords against the student's spoken question.
insert into public.faqs (office_id, question_keywords, answer) values
  ('11111111-1111-1111-1111-111111111111',
   'examen, data examen, cand examen, sesiune',
   'Examenul la cursul de Algoritmi are loc pe 15 ianuarie, ora 10:00, în sala C2.'),
  ('11111111-1111-1111-1111-111111111111',
   'restanta, retake, restante, refacere',
   'Sesiunea de restanțe este în perioada 5-9 februarie. Înscrierile se fac online până pe 1 februarie.'),
  ('11111111-1111-1111-1111-111111111111',
   'birou, unde, locatie, sala, adresa',
   'Cabinetul este în corpul A, etajul 2, sala A12. Intrarea principală din strada Academiei.'),
  ('11111111-1111-1111-1111-111111111111',
   'ore birou, office hours, program, cand pot veni',
   'Orele de birou sunt luni și miercuri 10:00-13:00, marți 14:00-16:00 și joi 09:00-11:00.')
on conflict do nothing;

-- staff_profiles (the professor's dashboard login) needs an auth.users id.
-- Create the user first (Supabase Dashboard > Authentication > Add user, OR an
-- invite flow), then link them to this office by running:
--
--   insert into public.staff_profiles (id, office_id, full_name, role, is_active)
--   values ('<AUTH_USER_UUID>', '11111111-1111-1111-1111-111111111111',
--           'Prof. dr. Andrei Popescu', 'owner', true);
