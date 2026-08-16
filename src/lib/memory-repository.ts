import { createHash } from "node:crypto";
import { getPool, hasDatabase } from "./db";
import type { WhatsAppParseResult } from "./whatsapp";
import type { IngestedVoiceCall } from "./repository";

export interface WhatsAppImportResult {
  documentId?: string;
  duplicate: boolean;
  messagesImported: number;
  factsExtracted: number;
  participants: string[];
  startedAt?: string;
  endedAt?: string;
  simulated: boolean;
}

export async function ingestWhatsAppImport(projectId: string, filename: string, raw: string, parsed: WhatsAppParseResult): Promise<WhatsAppImportResult> {
  const contentHash = createHash("sha256").update(raw).digest("hex");
  const resultBase = { messagesImported: parsed.messages.length, factsExtracted: parsed.facts.length, participants: parsed.participants, startedAt: parsed.startedAt?.toISOString(), endedAt: parsed.endedAt?.toISOString() };
  if (!hasDatabase()) return { ...resultBase, duplicate: false, simulated: true };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const documentResult = await client.query<{ id: string }>(`INSERT INTO source_documents (project_id, source_type, filename, content_hash, started_at, ended_at, entry_count, metadata)
      VALUES ($1, 'whatsapp', $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (project_id, source_type, content_hash) DO NOTHING RETURNING id`,
      [projectId, filename, contentHash, parsed.startedAt ?? null, parsed.endedAt ?? null, parsed.messages.length, JSON.stringify({ participants: parsed.participants, ignored_lines: parsed.ignoredLines })],
    );
    if (documentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ...resultBase, duplicate: true, simulated: false };
    }
    const documentId = documentResult.rows[0].id;
    const entryIds = new Map<number, string>();
    for (let offset = 0; offset < parsed.messages.length; offset += 200) {
      const batch = parsed.messages.slice(offset, offset + 200);
      const values: unknown[] = [];
      const placeholders = batch.map((message, index) => {
        const base = index * 7;
        values.push(documentId, projectId, message.ordinal, message.author, message.occurredAt, message.content, JSON.stringify({ is_media: message.isMedia }));
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7}::jsonb)`;
      });
      const entries = await client.query<{ id: string; ordinal: number }>(`INSERT INTO source_entries (document_id, project_id, ordinal, author, occurred_at, content, metadata) VALUES ${placeholders.join(",")} RETURNING id, ordinal`, values);
      for (const row of entries.rows) entryIds.set(row.ordinal, row.id);
    }

    for (const fact of parsed.facts) {
      const fingerprint = factFingerprint(fact.kind, fact.statement);
      const observedAt = parsed.messages[fact.messageOrdinal]?.occurredAt ?? new Date();
      const factResult = await client.query<{ id: string }>(`INSERT INTO memory_facts (project_id, kind, statement, owner_name, due_date, confidence, importance, fingerprint, first_observed_at, last_observed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
        ON CONFLICT (project_id, fingerprint) DO UPDATE SET last_observed_at = GREATEST(memory_facts.last_observed_at, EXCLUDED.last_observed_at), evidence_count = memory_facts.evidence_count + 1, confidence = GREATEST(memory_facts.confidence, EXCLUDED.confidence), owner_name = COALESCE(memory_facts.owner_name, EXCLUDED.owner_name), due_date = COALESCE(EXCLUDED.due_date, memory_facts.due_date), updated_at = now()
        RETURNING id`, [projectId, fact.kind, fact.statement, fact.owner ?? null, fact.dueDate ?? null, fact.confidence, fact.importance, fingerprint, observedAt]);
      const entryId = entryIds.get(fact.messageOrdinal);
      if (entryId) await client.query(`INSERT INTO memory_fact_evidence (fact_id, source_entry_id, excerpt) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [factResult.rows[0].id, entryId, fact.statement.slice(0, 500)]);
      await resolveSupersededFacts(client, projectId, factResult.rows[0].id, fact.statement, observedAt);
    }
    await client.query("COMMIT");
    return { ...resultBase, documentId, duplicate: false, simulated: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function factFingerprint(kind: string, statement: string) {
  const canonical = statement.toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\b(the|a|an|is|are|was|were|hai|hain|ka|ki|ke)\b/g, " ").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${kind}:${canonical}`).digest("hex");
}

export async function ingestVoiceMemory(call: IngestedVoiceCall) {
  if (!hasDatabase()) return;
  const candidates = [
    { key: "work_completed", kind: "progress", importance: 66 },
    { key: "challenges", kind: "issue", importance: 78 },
    { key: "tomorrow_plan", kind: "commitment", importance: 72 },
    { key: "blockers", kind: "risk", importance: 90 },
    { key: "safety", kind: "safety", importance: 94 },
    { key: "material_equipment", kind: "material", importance: 80 },
  ] as const;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const contact = await client.query<{ name: string }>(`SELECT name FROM project_contacts WHERE id = $1 AND project_id = $2`, [call.contactId, call.projectId]);
    const ownerName = contact.rows[0]?.name ?? "Site contact";
    const contentHash = createHash("sha256").update(call.conversationId).digest("hex");
    const doc = await client.query<{ id: string }>(`INSERT INTO source_documents (project_id, source_type, external_id, content_hash, started_at, ended_at, entry_count, metadata)
      VALUES ($1,'voice',$2,$3,$4,$5,$6,$7::jsonb)
      ON CONFLICT (project_id, source_type, content_hash) DO UPDATE SET ended_at = EXCLUDED.ended_at RETURNING id`, [call.projectId, call.conversationId, contentHash, call.startedAt, call.completedAt, call.transcript.length, JSON.stringify({ language: call.language, sentiment: call.sentiment })]);
    const documentId = doc.rows[0].id;
    for (let ordinal = 0; ordinal < call.transcript.length; ordinal += 1) {
      const turn = call.transcript[ordinal] as Record<string, unknown>;
      const content = typeof turn.message === "string" ? turn.message : "";
      if (!content) continue;
      const seconds = Number(turn.time_in_call_secs ?? turn.at ?? 0) || 0;
      await client.query(`INSERT INTO source_entries (document_id, project_id, ordinal, author, occurred_at, content, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (document_id, ordinal) DO NOTHING`, [documentId, call.projectId, ordinal, turn.role === "user" ? ownerName : "FieldBrief", new Date(call.startedAt.getTime() + seconds * 1000), content, JSON.stringify({ role: turn.role })]);
    }
    for (const candidate of candidates) {
      const statement = call.answers[candidate.key]?.trim();
      if (!statement || /^(none|none reported|no issue|no blocker|n\/a|nil)$/i.test(statement)) continue;
      const fingerprint = factFingerprint(candidate.kind, statement);
      const fact = await client.query<{ id: string }>(`INSERT INTO memory_facts (project_id, kind, statement, owner_name, confidence, importance, fingerprint, first_observed_at, last_observed_at)
        VALUES ($1,$2,$3,$4,0.94,$5,$6,$7,$7)
        ON CONFLICT (project_id, fingerprint) DO UPDATE SET last_observed_at = EXCLUDED.last_observed_at, evidence_count = memory_facts.evidence_count + 1, confidence = GREATEST(memory_facts.confidence, EXCLUDED.confidence), updated_at = now()
        RETURNING id`, [call.projectId, candidate.kind, statement, ownerName, candidate.importance, fingerprint, call.completedAt]);
      await client.query(`INSERT INTO memory_fact_evidence (fact_id, conversation_id, excerpt) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [fact.rows[0].id, call.conversationId, statement.slice(0, 500)]);
      await resolveSupersededFacts(client, call.projectId, fact.rows[0].id, statement, call.completedAt);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveSupersededFacts(client: import("pg").PoolClient, projectId: string, currentFactId: string, statement: string, observedAt: Date) {
  if (!/(resolved|closed|fixed|received|delivered|approved|clear now|no longer|solve[dk]|mil gaya|aa gaya|हो गया|मिल गया|आ गया|बंद हो गया)/i.test(statement)) return;
  await client.query(`UPDATE memory_facts SET status = 'resolved', resolved_at = $4, updated_at = now(), metadata = metadata || jsonb_build_object('resolved_by_fact_id', $2::text)
    WHERE project_id = $1 AND id <> $2::uuid AND status = 'active' AND kind IN ('risk','issue','material','commitment')
      AND similarity(statement, $3) >= 0.42`, [projectId, currentFactId, statement, observedAt]);
}
