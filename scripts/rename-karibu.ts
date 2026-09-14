/**
 * Renames the existing demo Country and Election rows from "Republic of
 * Karibu" / "Karibu General Election ..." to "Election Management
 * System" / "Election Management System General Election ...".
 *
 * This is a data-only rename, not a schema change -- and specifically
 * NOT something re-running prisma/seed.ts against an already-seeded
 * database would accomplish: every upsert in that script matches by a
 * stable identifier (the country's isoCode, each election's id) and has
 * an empty `update: {}` clause, so re-seeding an existing row leaves its
 * `name` field untouched even after the seed script's own source was
 * updated. This script does the explicit update seed.ts deliberately
 * doesn't.
 *
 * Scope: only the Country.name and the two seeded Election.name fields.
 * The fictional party ("Karibu Reform Movement") and observer
 * organization ("Karibu Civic Transparency Coalition") names are left
 * as-is -- those are flavor/theme content for the demo data, not the
 * system's own identity, and renaming a fictional party to "Election
 * Management System Reform Movement" wouldn't make it any less
 * fictional, just oddly named. Internal record ids (e.g.
 * "seed-karibu-general-2026") are also left unchanged, since three test
 * files reference them directly.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/rename-karibu.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const country = await db.country.findUnique({ where: { isoCode: "KRB" } });
  if (!country) {
    console.log('No country with isoCode "KRB" found -- nothing to rename.');
    await db.$disconnect();
    return;
  }

  console.log(`Renaming country "${country.name}" -> "Election Management System"`);
  await db.country.update({ where: { id: country.id }, data: { name: "Election Management System" } });

  const elections = await db.election.findMany({ where: { countryId: country.id } });
  for (const e of elections) {
    const newName = e.name.replace(/^Karibu\b/, "Election Management System");
    if (newName === e.name) continue;
    console.log(`Renaming election "${e.name}" -> "${newName}"`);
    await db.election.update({ where: { id: e.id }, data: { name: newName } });
  }

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
