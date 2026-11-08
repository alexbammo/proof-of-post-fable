// Thin PayPal REST client. Written against the docs on 8 Nov 2026; each call is marked
// in Docs/LOG.md as verified only once it has succeeded against the sandbox.

const BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
} as const;

export type PayPalEnv = keyof typeof BASE;

function env(): PayPalEnv {
  return (process.env.PAYPAL_ENV as PayPalEnv) === "live" ? "live" : "sandbox";
}

export function paypalBase() {
  return BASE[env()];
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError("oauth2/token", res.status, await res.text());
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export class PayPalError extends Error {
  status: number;
  body: string;
  debugId?: string;
  issues?: { issue: string; description?: string; field?: string }[];
  constructor(op: string, status: number, body: string) {
    super(`PayPal ${op} failed: HTTP ${status}`);
    this.status = status;
    this.body = body;
    try {
      const j = JSON.parse(body);
      this.debugId = j.debug_id;
      this.issues = j.details;
      if (j.message) this.message += ` - ${j.message}`;
      if (j.details?.[0]?.issue) this.message += ` [${j.details[0].issue}]`;
    } catch {
      /* non-JSON body */
    }
  }
}

export interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  requestId?: string; // PayPal-Request-Id for idempotency
  authAssertion?: string; // PayPal-Auth-Assertion for acting on behalf of a seller
  prefer?: "return=representation" | "return=minimal";
}

/** Authenticated JSON call. Always sends the BN code when configured. */
export async function paypal<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: opts.prefer ?? "return=representation",
  };
  if (process.env.PAYPAL_BN_CODE) headers["PayPal-Partner-Attribution-Id"] = process.env.PAYPAL_BN_CODE;
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  if (opts.authAssertion) headers["PayPal-Auth-Assertion"] = opts.authAssertion;
  const res = await fetch(`${paypalBase()}${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  if (!res.ok) throw new PayPalError(path, res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * PayPal-Auth-Assertion lets the platform call seller-scoped endpoints on the seller's behalf.
 * Unsigned JWT: header {alg:"none"} . payload {iss: clientId, payer_id: merchantId} . ""
 */
export function authAssertion(sellerMerchantId: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ iss: process.env.PAYPAL_CLIENT_ID, payer_id: sellerMerchantId })}.`;
}
