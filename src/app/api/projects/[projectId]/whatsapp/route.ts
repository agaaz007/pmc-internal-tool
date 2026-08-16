import { NextResponse } from "next/server";
import { ingestWhatsAppImport } from "@/lib/memory-repository";
import { getProjectDetail } from "@/lib/repository";
import { parseWhatsAppExport } from "@/lib/whatsapp";

export const runtime = "nodejs";

const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a WhatsApp .txt export in the file field." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") return NextResponse.json({ error: "Only WhatsApp .txt exports are supported." }, { status: 415 });
  if (file.size === 0 || file.size > maxBytes) return NextResponse.json({ error: "The export must be between 1 byte and 5 MB." }, { status: 413 });

  try {
    const raw = await file.text();
    const parsed = parseWhatsAppExport(raw);
    const result = await ingestWhatsAppImport(projectId, file.name, raw, parsed);
    return NextResponse.json({
      ...result,
      preview: parsed.facts.slice(0, 8).map((fact) => ({ kind: fact.kind, statement: fact.statement, owner: fact.owner, dueDate: fact.dueDate })),
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The chat export could not be processed." }, { status: 400 });
  }
}
