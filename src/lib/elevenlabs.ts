import { createHmac, timingSafeEqual } from "node:crypto";
import type { DispatchTarget, IngestedVoiceCall, VoiceContext } from "./repository";

export interface DispatchResult {
  success: boolean;
  conversationId: string | null;
  providerCallId: string | null;
  simulated: boolean;
  message: string;
}

interface ElevenLabsWebhook {
  type?: string;
  event_timestamp?: number;
  data?: Record<string, unknown>;
}

export function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 30 * 60) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = Number(parts.t);
  const received = parts.v0;
  if (!Number.isFinite(timestamp) || !received || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export async function dispatchElevenLabsCall(target: DispatchTarget, context: VoiceContext): Promise<DispatchResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId || !target.phoneE164) {
    return { success: true, conversationId: `sim_${crypto.randomUUID()}`, providerCallId: null, simulated: true, message: "Call simulated because a phone number or production credential is not configured." };
  }

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: { "content-type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: target.phoneE164,
      call_recording_enabled: true,
      conversation_initiation_client_data: {
        dynamic_variables: {
          contact_id: target.contactId,
          project_id: target.projectId,
          contact_name: target.contactName,
          contact_role: target.contactRole,
          project_name: target.projectName,
          project_code: target.projectCode,
          project_location: target.projectLocation,
          report_date: context.reportDate,
          previous_context: limitContext(context.previousContext, 3500),
          open_issues: limitContext(context.openIssues, 2500),
          milestones: limitContext(context.milestones, 1800),
        },
      },
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.success === false) {
    throw new Error(`ElevenLabs call failed (${response.status}): ${typeof body.detail === "string" ? body.detail : typeof body.message === "string" ? body.message : "Unknown provider error"}`);
  }
  return { success: true, conversationId: typeof body.conversation_id === "string" ? body.conversation_id : null, providerCallId: typeof body.callSid === "string" ? body.callSid : null, simulated: false, message: typeof body.message === "string" ? body.message : "Call dispatched" };
}

export function parseElevenLabsWebhook(rawBody: string): { event: ElevenLabsWebhook; call?: IngestedVoiceCall; eventKey: string; eventType: string } {
  const event = JSON.parse(rawBody) as ElevenLabsWebhook;
  const eventType = event.type ?? "unknown";
  const data = event.data ?? {};
  const conversationId = asString(data.conversation_id);
  const eventKey = conversationId || `${eventType}:${event.event_timestamp ?? "unknown"}`;
  if (eventType !== "post_call_transcription") return { event, eventKey, eventType };
  if (!conversationId) throw new Error("ElevenLabs webhook is missing conversation_id");

  const initiation = asRecord(data.conversation_initiation_client_data);
  const dynamic = asRecord(initiation.dynamic_variables);
  const projectId = asString(dynamic.project_id);
  const contactId = asString(dynamic.contact_id);
  if (!projectId || !contactId) throw new Error("ElevenLabs webhook is missing project_id or contact_id dynamic variables");
  const metadata = asRecord(data.metadata);
  const analysis = asRecord(data.analysis);
  const startedAtSeconds = asNumber(metadata.start_time_unix_secs) || asNumber(event.event_timestamp) - asNumber(metadata.call_duration_secs);
  const completedAtSeconds = asNumber(event.event_timestamp) || Math.floor(Date.now() / 1000);
  const dataCollection = asRecord(analysis.data_collection_results);

  return {
    event,
    eventKey,
    eventType,
    call: {
      conversationId,
      projectId,
      contactId,
      startedAt: new Date(startedAtSeconds * 1000),
      completedAt: new Date(completedAtSeconds * 1000),
      durationSeconds: asNumber(metadata.call_duration_secs),
      language: asString(metadata.main_language) || asString(data.language),
      sentiment: asString(analysis.transcript_sentiment) || asString(analysis.sentiment),
      summary: asString(analysis.transcript_summary) || asString(analysis.summary),
      transcript: Array.isArray(data.transcript) ? data.transcript : [],
      answers: {
        work_completed: dataCollectionValue(dataCollection.work_completed),
        challenges: dataCollectionValue(dataCollection.challenges),
        tomorrow_plan: dataCollectionValue(dataCollection.tomorrow_plan),
        blockers: dataCollectionValue(dataCollection.blockers),
        safety: dataCollectionValue(dataCollection.safety),
        manpower: dataCollectionValue(dataCollection.manpower),
        material_equipment: dataCollectionValue(dataCollection.material_equipment),
        callback_time: dataCollectionValue(dataCollection.callback_time),
      },
      analysis,
      metadata,
    },
  };
}

function dataCollectionValue(input: unknown): string {
  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  const record = asRecord(input);
  const value = record.value ?? record.result;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asString(value: unknown) { return typeof value === "string" ? value : ""; }
function asNumber(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function limitContext(value: string, max: number) { return value.length <= max ? value : `${value.slice(0, max - 1)}…`; }
