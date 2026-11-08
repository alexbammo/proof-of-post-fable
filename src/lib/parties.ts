import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

// Demo-scale identity: no login system in the hackathon build. The UI picks a brand and a
// creator from seeded records, so every action is attributed to a real row and audited.

export const DEMO_BRAND_ID = "brand_demo";
export const DEMO_CREATOR_ID = "creator_demo";

export async function ensureDemoParties() {
  const db = await getDb();
  const [b] = await db.select().from(schema.brands).where(eq(schema.brands.id, DEMO_BRAND_ID));
  if (!b) await db.insert(schema.brands).values({ id: DEMO_BRAND_ID, name: "Nimbus Tea Co.", email: "brand@nimbustea.example", tier: "starter" });
  const [c] = await db.select().from(schema.creators).where(eq(schema.creators.id, DEMO_CREATOR_ID));
  if (!c)
    await db.insert(schema.creators).values({
      id: DEMO_CREATOR_ID,
      name: "Maya Films",
      handle: "maya.films",
      email: "maya@creator.example",
      onboardingStatus: "not_started",
    });
}

export async function getBrand(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  return row ?? null;
}

export async function getCreator(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.creators).where(eq(schema.creators.id, id));
  return row ?? null;
}

export async function listCreators() {
  const db = await getDb();
  return db.select().from(schema.creators);
}

export async function createCreator(params: { name: string; handle: string; email?: string }) {
  const db = await getDb();
  const id = newId("creator");
  await db.insert(schema.creators).values({ id, ...params });
  return id;
}

export async function setCreatorPayPal(id: string, patch: { paypalMerchantId?: string | null; paypalEmail?: string | null; onboardingStatus?: string; onboardingTrackingId?: string | null }) {
  const db = await getDb();
  await db.update(schema.creators).set(patch).where(eq(schema.creators.id, id));
}
