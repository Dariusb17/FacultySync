/**
 * Outbound SMS fan-out to n8n — same indirection as dental-saas `lib/n8n-notify.ts`.
 *
 * We do NOT call Twilio directly. Each helper POSTs a JSON payload to a per-message
 * n8n webhook URL (env var); n8n delivers the SMS via Twilio. Every helper no-ops
 * if its webhook env var is unset, and every send is best-effort (callers wrap in
 * try/catch) so a messaging failure never breaks the core booking write.
 */

async function postWebhook(
  url: string | undefined,
  payload: Record<string, any>
): Promise<void> {
  if (!url) return; // not configured -> no-op
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // best-effort: log and swallow
    console.error("[sms-notify] webhook failed:", url, err);
  }
}

export type ConfirmationPayload = {
  studentName: string;
  officeName: string;
  professorName: string;
  meetingType: string;
  formattedTime: string;
};

/** Booking confirmation SMS to the student. */
export async function sendBookingConfirmation(
  phone: string,
  data: ConfirmationPayload
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_BOOKING_CONFIRMATION, {
    phone,
    ...data,
  });
}

/** Alert the office owner that a new booking came in. */
export async function sendOwnerNewBookingAlert(
  phone: string,
  data: ConfirmationPayload & { studentIdNumber: string; topic?: string }
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_OWNER_ALERT, { phone, ...data });
}

/** 24h-before reminder, includes the cancel-by-token link. */
export async function sendReminder24h(
  phone: string,
  data: ConfirmationPayload & { cancelLink: string }
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_REMINDER_24H, { phone, ...data });
}

/** Morning-of reminder. */
export async function sendReminderMorning(
  phone: string,
  data: ConfirmationPayload
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_REMINDER_MORNING, { phone, ...data });
}

/** Optional post-meeting feedback request. */
export async function sendFeedbackRequest(
  phone: string,
  data: { studentName: string; officeName: string; feedbackLink: string }
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_FEEDBACK_REQUEST, { phone, ...data });
}

/** Cancellation notice to the student. */
export async function sendCancellationNotice(
  phone: string,
  data: ConfirmationPayload
): Promise<void> {
  await postWebhook(process.env.N8N_WEBHOOK_OWNER_ALERT, {
    phone,
    cancelled: true,
    ...data,
  });
}
