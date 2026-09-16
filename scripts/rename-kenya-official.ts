/**
 * Renames the imported Kenya country's name from "Kenya" to its full
 * official name, "Republic of Kenya" -- matching the label the new
 * UI redesign's country selector is meant to show.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/rename-kenya-official.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const country = await db.country.findUnique({ where: { isoCode: "KE" } });
  if (!country) {
    console.log('No country with isoCode "KE" found -- nothing to rename.');
    await db.$disconnect();
    return;
  }

  console.log(`Renaming country "${country.name}" -> "Republic of Kenya"`);
  await db.country.update({ where: { id: country.id }, data: { name: "Republic of Kenya" } });

  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
