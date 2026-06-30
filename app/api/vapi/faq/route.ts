import { NextRequest } from "next/server";
import {
  verifyVapiSecret,
  vapiUnauthorized,
  parseVapiBody,
  resolveOffice,
  vapiResult,
} from "@/lib/vapi-auth";
import { adminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Vapi tool: faq.
 * Args: { question }. Matches the spoken question against each FAQ row's
 * question_keywords (comma/space separated) and returns the best answer.
 */
export async function POST(req: NextRequest) {
  if (!verifyVapiSecret(req)) return vapiUnauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = parseVapiBody(body);
  const office = await resolveOffice(parsed);
  if (!office) {
    return vapiResult(
      parsed.toolCallId,
      "Îmi pare rău, nu am putut identifica biroul. Vă rog reveniți mai târziu."
    );
  }

  const question: string = (parsed.args.question ?? parsed.args.query ?? "").toString();
  if (!question.trim()) {
    return vapiResult(parsed.toolCallId, "Ce întrebare aveți? Vă ascult.");
  }

  const { data: faqs } = await adminSupabase
    .from("faqs")
    .select("question_keywords, answer")
    .eq("office_id", office.id);

  if (!faqs || faqs.length === 0) {
    return vapiResult(
      parsed.toolCallId,
      "Nu am un răspuns configurat pentru această întrebare. Vă pot ajuta cu o programare?"
    );
  }

  const qWords = tokenize(question);
  let best: { answer: string; score: number } | null = null;

  for (const f of faqs) {
    const keywords = tokenize(f.question_keywords);
    let score = 0;
    for (const kw of keywords) {
      if (!kw) continue;
      // count a hit if any question word contains or equals the keyword
      if (qWords.some((w) => w === kw || w.includes(kw) || kw.includes(w))) {
        score += 1;
      }
    }
    if (!best || score > best.score) best = { answer: f.answer, score };
  }

  if (!best || best.score === 0) {
    return vapiResult(
      parsed.toolCallId,
      "Nu sunt sigur că am un răspuns exact la asta. Puteți reformula sau vă pot ajuta cu o programare?"
    );
  }

  return vapiResult(parsed.toolCallId, best.answer, { matched: true });
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics for matching
    .replace(/[^a-z0-9\s,]/g, " ")
    .split(/[\s,]+/)
    .filter((w) => w.length >= 3);
}
