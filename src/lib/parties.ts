import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

// Demo-scale identity: no login system in the hackathon build. The UI picks a brand and a
// creator from seeded records, so every action is attributed to a real row and audited.

export const DEMO_BRAND_ID = "brand_demo";
export const DEMO_CREATOR_ID = "creator_demo";
// The demo creator is the channel the demo videos are posted on.
const DEMO_CREATOR = { name: "Alex", handle: "alex-v7l8b" };

export async function ensureDemoParties() {
  const db = await getDb();
  const [b] = await db.select().from(schema.brands).where(eq(schema.brands.id, DEMO_BRAND_ID));
  if (!b) await db.insert(schema.brands).values({ id: DEMO_BRAND_ID, name: "Nimbus Tea Co.", email: "brand@nimbustea.example", tier: "starter" });
  const [c] = await db.select().from(schema.creators).where(eq(schema.creators.id, DEMO_CREATOR_ID));
  if (!c)
    await db.insert(schema.creators).values({
      id: DEMO_CREATOR_ID,
      ...DEMO_CREATOR,
      email: "alex@creator.example",
      onboardingStatus: "not_started",
    });
  // Display fields only: keep an already-seeded row in step with the demo channel. PayPal fields are untouched.
  else if (c.name !== DEMO_CREATOR.name || c.handle !== DEMO_CREATOR.handle)
    await db.update(schema.creators).set(DEMO_CREATOR).where(eq(schema.creators.id, DEMO_CREATOR_ID));
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
