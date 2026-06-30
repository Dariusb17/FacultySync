import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** List the office's FAQs. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await adminSupabase
    .from("faqs")
    .select("*")
    .eq("office_id", ctx.profile.office_id)
    .order("question_keywords", { ascending: true });

  return NextResponse.json({ faqs: data ?? [] });
}

/** Create or update a FAQ. Body: { id?, question_keywords, answer } */
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, question_keywords, answer } = body;
  if (!question_keywords?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  if (id) {
    // Update only within this office (scope guard).
    const { error } = await adminSupabase
      .from("faqs")
      .update({ question_keywords, answer })
      .eq("id", id)
      .eq("office_id", ctx.profile.office_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  }

  const { data, error } = await adminSupabase
    .from("faqs")
    .insert({
      office_id: ctx.profile.office_id,
      question_keywords,
      answer,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

/** Delete a FAQ. Body: { id }. Scoped to the office. */
export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await adminSupabase
    .from("faqs")
    .delete()
    .eq("id", body.id)
    .eq("office_id", ctx.profile.office_id);

  return NextResponse.json({ ok: true });
}
