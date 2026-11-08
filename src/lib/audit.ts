import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function audit(dealId: string | null, actor: string, action: string, detail?: unknown) {
  const db = await getDb();
  await db.insert(schema.auditEvents).values({
    id: newId("evt"),
    dealId,
    actor,
    action,
    detail: detail ?? null,
  });
}
