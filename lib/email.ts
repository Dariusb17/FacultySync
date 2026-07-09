import nodemailer from "nodemailer";

/**
 * Transactional email via Gmail SMTP (same approach as ClinicSync/dental-saas).
 * Best-effort: no-ops if unconfigured, never throws into the caller.
 *
 * Env:
 *   GMAIL_USER          — the Gmail address that sends (also the "from")
 *   GMAIL_APP_PASSWORD  — a Gmail App Password (16 chars)
 *   OFFICE_NOTIFY_EMAIL — where booking notifications go (the professor)
 */

export type BookingEmailData = {
  professorName: string;
  studentName: string;
  faculty: string | null;
  meetingType: string;
  formattedTime: string;
  topic?: string | null;
  dashboardUrl?: string;
};

export async function sendBookingNotification(
  data: BookingEmailData
): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.OFFICE_NOTIFY_EMAIL;
  if (!user || !pass || !to) return; // not configured -> no-op

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
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // STARTTLS
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"FacultyVoice" <${user}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("[email] Gmail send failed:", e);
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
