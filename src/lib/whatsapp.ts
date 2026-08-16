export interface WhatsAppMessage {
  ordinal: number;
  occurredAt: Date;
  author: string;
  content: string;
  isMedia: boolean;
}

export type MemoryKind = "progress" | "issue" | "decision" | "commitment" | "risk" | "safety" | "material" | "milestone";

export interface ExtractedMemoryFact {
  messageOrdinal: number;
  kind: MemoryKind;
  statement: string;
  owner?: string;
  dueDate?: string;
  importance: number;
  confidence: number;
}

export interface WhatsAppParseResult {
  messages: WhatsAppMessage[];
  facts: ExtractedMemoryFact[];
  participants: string[];
  startedAt?: Date;
  endedAt?: Date;
  ignoredLines: number;
}

const androidPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*([^:]+):\s*(.*)$/i;
const iosPattern = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\]\s*([^:]+):\s*(.*)$/i;
const newEntryPrefix = /^(?:\[?\d{1,2}\/\d{1,2}\/\d{2,4},)/;
const mediaPattern = /^(?:<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted)$/i;

export function parseWhatsAppExport(raw: string): WhatsAppParseResult {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\u202f/g, " ");
  const messages: WhatsAppMessage[] = [];
  let ignoredLines = 0;
  let current: WhatsAppMessage | undefined;

  for (const originalLine of normalized.split(/\r?\n/)) {
    const line = originalLine.trimEnd();
    const match = line.match(androidPattern) ?? line.match(iosPattern);
    if (match) {
      const [, day, month, year, hour, minute, second = "0", meridiem, author, content] = match;
      current = {
        ordinal: messages.length,
        occurredAt: parseIndianDate(day, month, year, hour, minute, second, meridiem),
        author: author.trim(),
        content: content.trim(),
        isMedia: mediaPattern.test(content.trim()),
      };
      messages.push(current);
      continue;
    }

    if (line && current && !newEntryPrefix.test(line)) {
      current.content += `\n${line.trim()}`;
      current.isMedia = mediaPattern.test(current.content.trim());
    } else if (line) {
      // Encryption notices, joins/leaves, and malformed date lines are not project evidence.
      ignoredLines += 1;
      current = undefined;
    }
  }

  if (messages.length === 0) throw new Error("No WhatsApp messages found. Export the chat without media as a .txt file and try again.");
  const participants = Array.from(new Set(messages.map((message) => message.author))).sort();
  return {
    messages,
    facts: messages.flatMap(extractFacts),
    participants,
    startedAt: messages[0]?.occurredAt,
    endedAt: messages.at(-1)?.occurredAt,
    ignoredLines,
  };
}

export function extractFacts(message: WhatsAppMessage): ExtractedMemoryFact[] {
  if (message.isMedia || message.content.length < 5) return [];
  const content = message.content.replace(/\s+/g, " ").trim();
  const lower = content.toLocaleLowerCase("en-IN");
  const facts: ExtractedMemoryFact[] = [];
  const dueDate = extractDueDate(lower, message.occurredAt);
  const push = (kind: MemoryKind, importance: number, confidence: number, owner?: string) => {
    if (!facts.some((fact) => fact.kind === kind)) facts.push({ messageOrdinal: message.ordinal, kind, statement: content.slice(0, 700), owner, dueDate, importance, confidence });
  };

  if (hasAny(lower, ["safety", "unsafe", "incident", "near miss", "accident", "ppe", "barricad", "permit", "toolbox", "चोट", "सुरक्षा", "हादसा"])) push("safety", 92, 0.88, message.author);
  if (hasAny(lower, ["approved", "approval given", "decided", "finalised", "finalized", "confirmed", "agreed", "go ahead", "proceed with", "freeze", "मंजूर", "तय हुआ", "फाइनल", "करने का फैसला"])) push("decision", 83, 0.86, message.author);
  if (hasAny(lower, ["blocked", "blocker", "delay", "late", "pending", "stuck", "on hold", "not received", "not available", "issue", "problem", "waiting for", "रुका", "अटका", "नहीं आया", "देरी", "पेंडिंग", "समस्या"])) push("risk", 87, 0.82, message.author);
  if (hasAny(lower, ["shortage", "delivery", "material", "cement", "steel", "rebar", "concrete", "bracket", "equipment", "crane", "hoist", "pump", "डीजल", "सामान", "मटेरियल", "मशीन"])) push("material", 72, 0.78, message.author);
  if (hasAny(lower, ["completed", "complete", "finished", "done", "closed", "installed", "poured", "cast", "erected", "handed over", "काम पूरा", "हो गया", "डाल दिया", "लग गया"])) push("progress", 66, 0.81, message.author);
  if (hasAny(lower, ["i will", "we will", "will send", "will share", "will complete", "by tomorrow", "tomorrow we", "eod", "eta", "कल तक", "कर दूंगा", "कर दूँगा", "भेज दूंगा", "भेज दूँगा", "हो जाएगा", "पूरा करेंगे"])) push("commitment", 79, 0.8, message.author);
  if (hasAny(lower, ["milestone", "handover", "top out", "top-out", "testing date", "commissioning", "completion date", "हैंडओवर", "लक्ष्य तारीख"])) push("milestone", 76, 0.79, message.author);
  if (facts.length === 0 && dueDate) push("commitment", 58, 0.66, message.author);
  return facts;
}

function parseIndianDate(day: string, month: string, year: string, hour: string, minute: string, second: string, meridiem?: string) {
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  let hour24 = Number(hour);
  if (meridiem?.toLowerCase() === "pm" && hour24 < 12) hour24 += 12;
  if (meridiem?.toLowerCase() === "am" && hour24 === 12) hour24 = 0;
  const iso = `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour24).padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+05:30`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid WhatsApp timestamp: ${day}/${month}/${year} ${hour}:${minute}`);
  return date;
}

function extractDueDate(content: string, observedAt: Date): string | undefined {
  const explicit = content.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (explicit) {
    const year = explicit[3] ? (explicit[3].length === 2 ? 2000 + Number(explicit[3]) : Number(explicit[3])) : observedAt.getUTCFullYear();
    return `${year}-${explicit[2].padStart(2, "0")}-${explicit[1].padStart(2, "0")}`;
  }
  if (/\b(tomorrow|kal|कल)\b/.test(content)) {
    const tomorrow = new Date(observedAt.getTime() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  }
  return undefined;
}

function hasAny(content: string, terms: string[]) {
  return terms.some((term) => content.includes(term));
}
