import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseElevenLabsWebhook, verifyElevenLabsSignature } from "../src/lib/elevenlabs";

test("validates ElevenLabs webhook HMAC and rejects tampering", () => {
  const raw = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "conv_1" } });
  const secret = "whsec_test";
  const timestamp = 1_800_000_000;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const header = `t=${timestamp},v0=${digest}`;
  assert.equal(verifyElevenLabsSignature(raw, header, secret, timestamp), true);
  assert.equal(verifyElevenLabsSignature(`${raw} `, header, secret, timestamp), false);
  assert.equal(verifyElevenLabsSignature(raw, header, secret, timestamp + 2_000), false);
});

test("normalizes a post-call transcription into the internal call contract", () => {
  const raw = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: 1_800_000_300,
    data: {
      conversation_id: "conv_fieldbrief_1",
      conversation_initiation_client_data: { dynamic_variables: { project_id: "meridian-heights", contact_id: "contact-1" } },
      metadata: { start_time_unix_secs: 1_800_000_000, call_duration_secs: 300, main_language: "hi" },
      transcript: [{ role: "user", message: "L26 reinforcement complete", time_in_call_secs: 12 }],
      analysis: {
        transcript_summary: "Structure target completed.",
        transcript_sentiment: "positive",
        data_collection_results: { work_completed: { value: "L26 reinforcement complete" }, blockers: { value: "180 brackets pending" }, manpower: { value: 184 } },
      },
    },
  });
  const parsed = parseElevenLabsWebhook(raw);
  assert.equal(parsed.call?.conversationId, "conv_fieldbrief_1");
  assert.equal(parsed.call?.projectId, "meridian-heights");
  assert.equal(parsed.call?.answers.work_completed, "L26 reinforcement complete");
  assert.equal(parsed.call?.answers.manpower, "184");
});
