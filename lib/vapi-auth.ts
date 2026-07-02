import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "./supabase";
import type { Office } from "./types";

/**
 * Vapi tool-webhook helpers.
 *
 * Vapi owns the conversation and calls our tool endpoints mid-call. Each request
 * is authenticated by a shared secret header (configured on the assistant's
 * server URL) — the analogue of dental-saas's `api_key` check on /api/booking.
 *
 * Multi-tenancy: office_id is resolved from the payload — either an explicit
 * office_id passed in the tool arguments (assistant metadata / variable), or the
 * dialed phone number matched against offices.twilio_number.
 */

const SECRET_HEADER = "x-vapi-secret";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the Vapi shared secret. Accepts it either as the `x-vapi-secret`
 * header (Vapi's server-secret mechanism) OR as a `?secret=` query parameter on
 * the tool URL. The query form is bulletproof — the URL is always sent exactly
 * as configured — so it works regardless of how the Vapi dashboard wires the
 * server secret.
 */
export function verifyVapiSecret(req: NextRequest): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return false; // fail closed if unconfigured
  const headerSecret = req.headers.get(SECRET_HEADER) ?? "";
  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";
  return (
    timingSafeEqual(headerSecret, expected) ||
    timingSafeEqual(querySecret, expected)
  );
}

export type ParsedVapiTool = {
  toolCallId: string | null;
  name: string;
  args: Record<string, any>;
  dialedNumber: string | null;
  /** office_id hinted in args/metadata, if any. */
  hintedOfficeId: string | null;
};

/**
 * Pull the tool name + arguments + routing hints out of a Vapi webhook body.
 * Handles both the `toolCallList`/`toolCalls` shape and the legacy
 * `functionCall` shape.
 */
export function parseVapiBody(body: any): ParsedVapiTool {
  const message = body?.message ?? body ?? {};

  // Tool-call list (current Vapi format)
  const toolCall =
    message?.toolCallList?.[0] ??
    message?.toolCalls?.[0] ??
    message?.toolCall ??
    null;

  let name = "";
  let args: Record<string, any> = {};
  let toolCallId: string | null = null;

  if (toolCall) {
    toolCallId = toolCall.id ?? toolCall.toolCallId ?? null;
    name = toolCall.name ?? toolCall.function?.name ?? "";
    const rawArgs = toolCall.arguments ?? toolCall.function?.arguments ?? {};
    args = typeof rawArgs === "string" ? safeJson(rawArgs) : rawArgs ?? {};
  } else if (message?.functionCall) {
    // Legacy function-call shape
    name = message.functionCall.name ?? "";
    const rawArgs = message.functionCall.parameters ?? message.functionCall.arguments ?? {};
    args = typeof rawArgs === "string" ? safeJson(rawArgs) : rawArgs ?? {};
  }

  // Dialed number: the office's Twilio number Vapi answered on.
  const call = message?.call ?? {};
  const dialedNumber =
    call?.phoneNumber?.number ??
    message?.phoneNumber?.number ??
    call?.phoneNumberE164 ??
    call?.to ??
    null;

  // office_id can be injected via assistant metadata / variable values.
  const hintedOfficeId =
    args?.office_id ??
    call?.assistantOverrides?.variableValues?.office_id ??
    call?.assistant?.metadata?.office_id ??
    message?.assistant?.metadata?.office_id ??
    call?.metadata?.office_id ??
    null;

  return { toolCallId, name, args: args ?? {}, dialedNumber, hintedOfficeId };
}

function safeJson(s: string): Record<string, any> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Resolve the tenant office from the parsed payload: prefer an explicit
 * office_id, else match the dialed number against offices.twilio_number.
 */
export async function resolveOffice(
  parsed: ParsedVapiTool
): Promise<Office | null> {
  if (parsed.hintedOfficeId) {
    const { data } = await adminSupabase
      .from("offices")
      .select("*")
      .eq("id", parsed.hintedOfficeId)
      .maybeSingle();
    if (data) return data as Office;
  }
  if (parsed.dialedNumber) {
    const { data } = await adminSupabase
      .from("offices")
      .select("*")
      .eq("twilio_number", parsed.dialedNumber)
      .maybeSingle();
    if (data) return data as Office;
  }
  // Single-office deployment fallback: if DEFAULT_OFFICE_ID is set and nothing
  // else resolved the tenant, use it. Lets one assistant work without injecting
  // office_id via metadata or matching a dialed number (handy for web-call demos).
  const fallback = process.env.DEFAULT_OFFICE_ID;
  if (fallback) {
    const { data } = await adminSupabase
      .from("offices")
      .select("*")
      .eq("id", fallback)
      .maybeSingle();
    if (data) return data as Office;
  }
  return null;
}

/**
 * Format a tool result for Vapi. Vapi speaks back the `result` string, so we
 * return a human-readable message plus the structured payload for logging.
 */
export function vapiResult(
  toolCallId: string | null,
  result: string,
  extra?: Record<string, any>
): NextResponse {
  return NextResponse.json({
    results: [
      {
        toolCallId: toolCallId ?? undefined,
        result,
        ...(extra ? { metadata: extra } : {}),
      },
    ],
  });
}

/** 401 helper for failed secret verification. */
export function vapiUnauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
