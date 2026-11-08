import { randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/i/l/o

export function newId(prefix: string, len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}_${out}`;
}
