/**
 * Transactional email via Brevo's HTTP API (no SMTP, no extra dependency).
 * Best-effort: no-ops if unconfigured, never throws into the caller.
 *
 * Env:
 *   BREVO_API_KEY       — Brevo API key (Settings -> SMTP & API -> API Keys, xkeysib-…)
 *   BREVO_SENDER_EMAIL  — a VERIFIED sender in Brevo (the "from" address)
 *   BREVO_SENDER_NAME   — display name for the sender (optional)
 *   OFFICE_NOTIFY_EMAIL — where booking notifications go (the professor)
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type BookingEmailData = {
  professorName: string;
  studentName: string;
  faculty: string | null;
  meetingType: string;
  formattedTime: string;
  topic?: string | null;
  dashboardUrl?: string;
  /** Recipient; falls back to OFFICE_NOTIFY_EMAIL when absent. */
  to?: string | null;
};

export async function sendBookingNotification(
  data: BookingEmailData
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  const to = data.to || process.env.OFFICE_NOTIFY_EMAIL;
  if (!apiKey || !sender || !to) return; // not configured -> no-op

  const subject = `Programare nouă — ${data.studentName}`;
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:14px;padding:20px 22px;color:#fff">
        <p style="margin:0;font-size:13px;opacity:.85">FacultyVoice · agent vocal</p>
        <h1 style="margin:6px 0 0;font-size:19px">Programare nouă</h1>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:20px 22px">
        <p style="margin:0 0 14px;color:#475569">
          Un student a rezervat un interval la orele de birou ale ${escapeHtml(
            data.professorName
          )}:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${row("Student", data.studentName)}
          ${row("Facultate", data.faculty ?? "—")}
          ${row("Tip întâlnire", data.meetingType)}
          ${row("Data și ora", data.formattedTime)}
          ${data.topic ? row("Subiect", data.topic) : ""}
        </table>
        ${
          data.dashboardUrl
            ? `<a href="${data.dashboardUrl}" style="display:inline-block;margin-top:18px;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">Vezi în panou</a>`
            : ""
        }
      </div>
    </div>`;

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: sender,
          name: process.env.BREVO_SENDER_NAME || "FacultyVoice",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Brevo error:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[email] Brevo send failed:", e);
  }
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#94a3b8;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:6px 0 6px 16px;font-weight:600">${escapeHtml(value)}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
