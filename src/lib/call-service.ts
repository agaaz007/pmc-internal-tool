import { dispatchElevenLabsCall } from "./elevenlabs";
import { getVoiceContext, listDispatchTargets, recordCallDispatch, type DispatchTarget } from "./repository";

export interface CallRunResult {
  requested: number;
  dispatched: number;
  simulated: boolean;
  results: Array<{ contactId: string; contactName: string; success: boolean; simulated: boolean; conversationId?: string; error?: string }>;
}

export async function runCallDispatch(options: { projectId?: string; contactId?: string; dueOnly?: boolean; at?: Date }): Promise<CallRunResult> {
  const targets = await listDispatchTargets(options);
  const results: CallRunResult["results"] = [];
  for (let offset = 0; offset < targets.length; offset += 3) {
    const batch = targets.slice(offset, offset + 3);
    const batchResults = await Promise.all(batch.map(dispatchOne));
    results.push(...batchResults);
  }
  return { requested: targets.length, dispatched: results.filter((result) => result.success).length, simulated: results.length > 0 && results.every((result) => result.simulated), results };
}

async function dispatchOne(target: DispatchTarget): Promise<CallRunResult["results"][number]> {
  try {
    const context = await getVoiceContext(target);
    const result = await dispatchElevenLabsCall(target, context);
    if (!result.simulated) await recordCallDispatch(target, result.conversationId, result.providerCallId);
    return { contactId: target.contactId, contactName: target.contactName, success: result.success, simulated: result.simulated, conversationId: result.conversationId ?? undefined };
  } catch (error) {
    return { contactId: target.contactId, contactName: target.contactName, success: false, simulated: false, error: error instanceof Error ? error.message : "Unknown call error" };
  }
}
