import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// Money is stored in integer cents (USD) everywhere.

export const dealStatuses = [
  "draft",
  "agreed",
  "funded",
  "awaiting_post",
  "live_checking",
  "fix_window",
  "partially_released",
  "released",
  "refunded",
  "disputed",
  "closed",
] as const;
export type DealStatus = (typeof dealStatuses)[number];

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  tier: text("tier").notNull().default("starter"), // starter | growth | pro | enterprise
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creators = pgTable("creators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  handle: text("handle"), // display handle, e.g. @maya.films
  paypalMerchantId: text("paypal_merchant_id"),
  paypalEmail: text("paypal_email"),
  onboardingStatus: text("onboarding_status").notNull().default("not_started"), // not_started | pending | complete
  onboardingTrackingId: text("onboarding_tracking_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull().references(() => brands.id),
    creatorId: text("creator_id").notNull().references(() => creators.id),
    title: text("title").notNull(),
    status: text("status").$type<DealStatus>().notNull().default("draft"),
    terms: jsonb("terms").$type<DealTerms>().notNull(),
    // Money (cents)
    priceCents: integer("price_cents").notNull(), // what the creator receives
    platformFeeCents: integer("platform_fee_cents").notNull(),
    processingFeeCents: integer("processing_fee_cents").notNull(), // PayPal's estimated cut
    brandTotalCents: integer("brand_total_cents").notNull(), // what the brand pays
    releasedCents: integer("released_cents").notNull().default(0),
    refundedCents: integer("refunded_cents").notNull().default(0),
    // Signatures
    brandAcceptedAt: timestamp("brand_accepted_at", { withTimezone: true }),
    creatorAcceptedAt: timestamp("creator_accepted_at", { withTimezone: true }),
    // Go-live and demo clock
    goLiveAt: timestamp("go_live_at", { withTimezone: true }),
    clockOffsetDays: integer("clock_offset_days").notNull().default(0), // demo "time warp"
    fixWindowEndsAt: timestamp("fix_window_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deals_brand_idx").on(t.brandId), index("deals_creator_idx").on(t.creatorId)],
);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id),
  mode: text("mode").notNull(), // multiparty | payouts_fallback
  paypalOrderId: text("paypal_order_id"),
  paypalAuthorizationId: text("paypal_authorization_id"),
  paypalCaptureId: text("paypal_capture_id"),
  paypalPayoutBatchId: text("paypal_payout_batch_id"),
  paypalRefundId: text("paypal_refund_id"),
  status: text("status").notNull().default("created"), // created | approved | captured | held | released | refunded | failed
  amountCents: integer("amount_cents").notNull(),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id),
  platform: text("platform").notNull(), // youtube | twitch | bluesky | manual
  url: text("url").notNull(),
  ref: jsonb("ref").notNull(), // PostRef
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  screenshotPath: text("screenshot_path"), // manual fallback
  trust: text("trust").notNull().default("platform"), // platform | manual
});

export const checks = pgTable(
  "checks",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id").notNull().references(() => deals.id),
    postId: text("post_id").references(() => posts.id),
    kind: text("kind").notNull(), // initial | recheck | fix_recheck
    dealDay: integer("deal_day").notNull().default(0), // days since go-live, demo clock aware
    snapshot: jsonb("snapshot"), // PostSnapshot
    verdict: jsonb("verdict").$type<Verdict>(),
    model: text("model"), // which model produced the verdict, or "code" for a plain-code recheck
    changed: boolean("changed"), // recheck: did the post change since last snapshot?
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("checks_deal_idx").on(t.dealId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id").references(() => deals.id),
    actor: text("actor").notNull(), // brand:<id> | creator:<id> | system | ai:<model> | paypal | admin
    action: text("action").notNull(),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_deal_idx").on(t.dealId)],
);

export const disputes = pgTable("disputes", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id),
  openedBy: text("opened_by").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | resolved_release | resolved_refund
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id),
  role: text("role").notNull(), // brand | creator | assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- JSON shapes stored in jsonb columns ----

export type Platform = "youtube" | "twitch" | "bluesky" | "manual";

export interface DealTerms {
  platform: Platform;
  creatorAccount: string; // handle / channel the post must come from
  deliverable: string; // plain-English description of the post
  postBy: string; // ISO date
  stayUpDays: number;
  requiredMentions: string[]; // brand names / handles that must appear
  requiredHashtags: string[]; // e.g. ["#ad", "#NimbusTea"]
  requiredLinks: string[];
  disclosureRequired: boolean; // the #ad / paid-promotion label
  minViews: number | null;
  priceUsd: number; // what the creator receives
  payoutSchedule: { atGoLivePct: number; afterStayUpPct: number };
  notes: string;
}

export interface VerdictCheck {
  term: string;
  ok: boolean;
  evidence: string;
  note: string;
}

export interface Verdict {
  verdict: "pass" | "fail" | "needs_review";
  checks: VerdictCheck[];
  summary: string;
  confidence: number;
  injectionDetected?: boolean;
}

export type Brand = typeof brands.$inferSelect;
export type Creator = typeof creators.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
