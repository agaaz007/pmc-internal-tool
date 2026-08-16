import assert from "node:assert/strict";
import test from "node:test";
import { parseWhatsAppExport } from "../src/lib/whatsapp";

test("parses Android WhatsApp exports, multiline messages, Hindi, and memory facts", () => {
  const input = `17/08/26, 5:30 pm - Messages and calls are end-to-end encrypted.
17/08/26, 5:31 pm - Vikram Shah: Tower B L26 reinforcement completed, 42 tonnes done.
Consultant inspection also closed.
17/08/26, 5:33 pm - Arjun Mehta: Brackets नहीं आया. West elevation blocked after Wednesday.
17/08/26, 5:35 pm - Arjun Mehta: Main supplier se kal tak recovery date confirm kar दूँगा.
17/08/26, 5:38 pm - Dinesh Yadav: <Media omitted>`;
  const result = parseWhatsAppExport(input);
  assert.equal(result.messages.length, 4);
  assert.equal(result.messages[0].content.includes("Consultant inspection"), true);
  assert.deepEqual(result.participants, ["Arjun Mehta", "Dinesh Yadav", "Vikram Shah"]);
  assert.equal(result.facts.some((fact) => fact.kind === "progress"), true);
  assert.equal(result.facts.some((fact) => fact.kind === "risk"), true);
  const commitment = result.facts.find((fact) => fact.kind === "commitment");
  assert.equal(commitment?.owner, "Arjun Mehta");
  assert.equal(commitment?.dueDate, "2026-08-18");
});

test("parses iPhone exports with 24-hour timestamps", () => {
  const input = `[16/08/2026, 18:04:12] Sana Mirza: RFI-118 pending, riser work is on hold.
[16/08/2026, 18:06:10] Consultant: Drawing approved. Please proceed with the revised clearance.`;
  const result = parseWhatsAppExport(input);
  assert.equal(result.messages.length, 2);
  assert.equal(result.facts.some((fact) => fact.kind === "decision"), true);
  assert.equal(result.facts.some((fact) => fact.kind === "risk"), true);
});

test("rejects files with no parseable messages", () => {
  assert.throws(() => parseWhatsAppExport("just a random text file"), /No WhatsApp messages found/);
});
