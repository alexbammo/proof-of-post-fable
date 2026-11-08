import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function bad(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("invalid JSON body");
  }
}

/** Route handler wrapper: turns thrown errors into JSON 4xx/5xx without leaking stacks. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = /not found/i.test(msg) ? 404 : /invalid|must|cannot|not configured|does not match|no post|nothing/i.test(msg) ? 400 : 500;
      if (status === 500) console.error(e);
      return bad(msg, status);
    }
  };
}

export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error("admin token not configured on this server");
  const got = req.headers.get("x-admin-token") ?? new URL(req.url).searchParams.get("token");
  if (got !== token) throw new Error("admin token invalid");
}
