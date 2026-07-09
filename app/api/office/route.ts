import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Return the current office's editable settings. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await adminSupabase
    .from("offices")
    .select("*") // resilient if notify_email column not yet added
    .eq("id", ctx.profile.office_id)
    .maybeSingle();

  const o = (data ?? {}) as Record<string, any>;
  return NextResponse.json({
    office: data
      ? {
          name: o.name ?? "",
          professor_name: o.professor_name ?? "",
          notify_email: o.notify_email ?? "",
          greeting: o.greeting ?? "",
          feedback_link: o.feedback_link ?? "",
        }
      : null,
  });
}

/**
 * Update the office's settings. Only whitelisted fields; office-scoped.
 * Body: { name?, professor_name?, notify_email?, greeting?, feedback_link? }
 */
export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const allowed = [
    "name",
    "professor_name",
    "notify_email",
    "greeting",
    "feedback_link",
  ] as const;

  const update: Record<string, string | null> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k] === "" ? null : body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  // Light validation of the notification email.
  if (
    update.notify_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.notify_email)
  ) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("offices")
    .update(update)
    .eq("id", ctx.profile.office_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
