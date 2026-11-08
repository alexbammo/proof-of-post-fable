import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Deal, DealStatus, DealTerms, Verdict } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { quote, type Tier } from "@/lib/money";

// Deal lifecycle:
// draft → agreed → funded → awaiting_post → live_checking → (released | partially_released | fix_window → refunded) → closed

const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  draft: ["agreed"],
  agreed: ["funded", "draft"],
  funded: ["awaiting_post"],
  awaiting_post: ["live_checking", "fix_window"],
  live_checking: ["released", "partially_released", "fix_window", "disputed"],
  partially_released: ["released", "fix_window", "disputed"],
  fix_window: ["live_checking", "refunded", "disputed"],
  disputed: ["released", "refunded"],
  released: ["closed"],
  refunded: ["closed"],
  closed: [],
};

export function canTransition(from: DealStatus, to: DealStatus) {
  return TRANSITIONS[from].includes(to);
}

export async function setStatus(dealId: string, to: DealStatus, actor: string, detail?: unknown) {
  const db = await getDb();
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  if (!canTransition(deal.status, to)) throw new Error(`Cannot move deal from ${deal.status} to ${to}`);
  await db.update(schema.deals).set({ status: to, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  await audit(dealId, actor, `status:${deal.status}→${to}`, detail);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDealFull(id: string) {
  const db = await getDb();
  const deal = await getDeal(id);
  if (!deal) return null;
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, deal.brandId));
  const [creator] = await db.select().from(schema.creators).where(eq(schema.creators.id, deal.creatorId));
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.dealId, id)).orderBy(desc(schema.payments.createdAt));
  const posts = await db.select().from(schema.posts).where(eq(schema.posts.dealId, id)).orderBy(desc(schema.posts.submittedAt));
  const checks = await db.select().from(schema.checks).where(eq(schema.checks.dealId, id)).orderBy(desc(schema.checks.createdAt));
  const events = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.dealId, id)).orderBy(desc(schema.auditEvents.createdAt));
  const messages = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.dealId, id)).orderBy(schema.chatMessages.createdAt);
  return { deal, brand, creator, payments, posts, checks, events, messages };
}

export async function listDeals() {
  const db = await getDb();
  return db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt));
}

export async function createDraftDeal(params: { brandId: string; creatorId: string; title: string; terms: DealTerms; tier?: Tier }) {
  const db = await getDb();
  const id = newId("deal");
  const q = quote(Math.round(params.terms.priceUsd * 100), params.tier ?? "starter");
  await db.insert(schema.deals).values({
    id,
    brandId: params.brandId,
    creatorId: params.creatorId,
    title: params.title,
    status: "draft",
    terms: params.terms,
    priceCents: q.priceCents,
    platformFeeCents: q.platformFeeCents,
    processingFeeCents: q.processingFeeCents,
    brandTotalCents: q.brandTotalCents,
  });
  await audit(id, "system", "deal:created", { title: params.title });
  return id;
}

/** Re-price a draft when the terms change in the builder chat. */
export async function updateDraftTerms(dealId: string, terms: DealTerms, tier: Tier = "starter") {
  const db = await getDb();
  const q = quote(Math.round(terms.priceUsd * 100), tier);
  await db
    .update(schema.deals)
    .set({
      terms,
      priceCents: q.priceCents,
      platformFeeCents: q.platformFeeCents,
      processingFeeCents: q.processingFeeCents,
      brandTotalCents: q.brandTotalCents,
      title: terms.deliverable ? terms.deliverable.slice(0, 80) : "Untitled deal",
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, dealId));
}

export async function acceptTerms(dealId: string, side: "brand" | "creator") {
  const db = await getDb();
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  if (deal.status !== "draft") throw new Error("terms can only be accepted on a draft");
  const now = new Date();
  const patch = side === "brand" ? { brandAcceptedAt: now } : { creatorAcceptedAt: now };
  await db.update(schema.deals).set({ ...patch, updatedAt: now }).where(eq(schema.deals.id, dealId));
  await audit(dealId, `${side}:${side === "brand" ? deal.brandId : deal.creatorId}`, "terms:accepted");
  const both = (side === "brand" ? deal.creatorAcceptedAt : deal.brandAcceptedAt) != null;
  if (both) await setStatus(dealId, "agreed", "system", { reason: "both sides accepted" });
  return both;
}

/** Demo clock: "now" for a deal, shifted by the admin time-warp offset. */
export function dealNow(deal: Pick<Deal, "clockOffsetDays">): Date {
  return new Date(Date.now() + deal.clockOffsetDays * 86_400_000);
}

export function dealDay(deal: Pick<Deal, "clockOffsetDays" | "goLiveAt">): number {
  if (!deal.goLiveAt) return 0;
  return Math.floor((dealNow(deal).getTime() - deal.goLiveAt.getTime()) / 86_400_000);
}

export async function recordCheck(params: {
  dealId: string;
  postId: string | null;
  kind: "initial" | "recheck" | "fix_recheck";
  dealDay: number;
  snapshot: unknown;
  verdict: Verdict | null;
  model: string;
  changed?: boolean;
}) {
  const db = await getDb();
  const id = newId("chk");
  await db.insert(schema.checks).values({ id, ...params, verdict: params.verdict ?? undefined, changed: params.changed ?? null });
  await audit(params.dealId, `ai:${params.model}`, `check:${params.kind}`, {
    verdict: params.verdict?.verdict ?? null,
    confidence: params.verdict?.confidence ?? null,
    dealDay: params.dealDay,
    changed: params.changed ?? null,
  });
  return id;
}
