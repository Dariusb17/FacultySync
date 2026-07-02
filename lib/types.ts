/** Shared row types mirroring the Supabase schema (see supabase/schema.sql). */

export type Office = {
  id: string;
  name: string;
  professor_name: string;
  office_phone: string | null;
  twilio_number: string | null;
  greeting: string | null;
  feedback_link: string | null;
  api_key: string | null;
  created_at: string;
};

export type Student = {
  id: string;
  office_id: string;
  full_name: string;
  student_id_number: string;
  phone: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  office_id: string;
  student_name: string;
  faculty: string | null;
  student_id_number: string | null;
  student_phone: string | null;
  meeting_type: string;
  topic: string | null;
  slot_time: string; // ISO UTC
  end_time: string; // ISO UTC
  duration_minutes: number;
  student_id: string | null;
  source: string;
  reminder_24h_sent: boolean;
  reminder_morning_sent: boolean;
  feedback_sent: boolean;
  cancelled: boolean;
  cancel_token: string | null;
  created_at: string;
};

export type MeetingType = {
  id: string;
  office_id: string;
  name: string;
  duration_minutes: number;
};

export type OfficeHours = {
  id: string;
  office_id: string;
  day_of_week: number; // 0=Mon … 6=Sun
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
};

export type OfficeBlock = {
  id: string;
  office_id: string;
  start_time: string; // ISO UTC
  end_time: string; // ISO UTC
  reason: string | null;
  created_at: string;
};

export type Faq = {
  id: string;
  office_id: string;
  question_keywords: string;
  answer: string;
};

export type StaffProfile = {
  id: string;
  office_id: string;
  full_name: string;
  role: "owner" | "assistant";
  is_active: boolean;
};
