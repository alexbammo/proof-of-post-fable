import { getDb, schema } from "../src/lib/db";
import { randomUUID } from "node:crypto";
async function main() {
  const db = await getDb();
  const id = "brand_" + randomUUID().slice(0, 8);
  await db.insert(schema.brands).values({ id, name: "Spike Brand" });
  const rows = await db.select().from(schema.brands);
  console.log("brands:", rows.length, "latest:", rows.at(-1)?.name);
  await db.delete(schema.brands);
  console.log("db ok");
}
main().catch((e) => { console.error(e); process.exit(1); });
