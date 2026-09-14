/**
 * Upgrades "combined N polling stations" aggregate rows (created by
 * scripts/import-kenya-real-polling-stations.ts, when IEBC's
 * registration-centre report only gave a combined total for a
 * multi-station centre) to the true individual polling stations, now
 * that a separate, genuinely per-station IEBC document
 * (rov_per_polling_station.pdf, the final voter register published 6
 * days before the 2022 election) has been parsed.
 *
 * SAFETY RULE -- this is the entire point of the script: a centre is
 * only upgraded if the newly-parsed individual stations are a COMPLETE,
 * EXACT match for what's already in the database -- same total voter
 * count, same station count as recorded in the aggregate's own label
 * ("combined N polling stations"). ~99.9% of centres parsed cleanly
 * from the source PDF (46,179 of 46,229 real stations); the remaining
 * ~50 involve exotic multi-line PDF wrapping this script's source
 * extraction couldn't fully resolve with confidence. Rather than guess
 * at an incomplete split, any centre that doesn't reconcile exactly is
 * left untouched as its existing, already-correct combined aggregate.
 * A partial upgrade is not attempted anywhere.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/upgrade-to-individual-stations.ts \
 *     scripts/per-station-breakdown.json
 */
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type Breakdown = Record<string, [string, string, number][]>;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/upgrade-to-individual-stations.ts <per-station-breakdown.json>");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const breakdown: Breakdown = JSON.parse(readFileSync(filePath, "utf-8"));
  console.log(`Loaded individual-station breakdowns for ${Object.keys(breakdown).length} registration centres.`);

  const kenya = await db.country.findUniqueOrThrow({ where: { isoCode: "KE" } });

  const centres = await db.pollingCenter.findMany({
    where: { unit: { level: { countryId: kenya.id } } },
    include: { stations: true },
  });

  let upgraded = 0;
  let skippedIncomplete = 0;
  let skippedAlreadyIndividual = 0;
  let skippedNoBreakdown = 0;

  for (const centre of centres) {
    if (centre.stations.length !== 1) {
      skippedAlreadyIndividual++;
      continue;
    }
    const existing = centre.stations[0];
    const parsedStations = breakdown[centre.code];
    if (!parsedStations) {
      skippedNoBreakdown++;
      continue;
    }

    const parsedTotalVoters = parsedStations.reduce((sum, [, , v]) => sum + v, 0);
    const labelMatch = existing.name.match(/\(combined (\d+) polling stations\)/);
    const expectedStationCount = labelMatch ? Number(labelMatch[1]) : 1;

    const exactMatch =
      parsedStations.length === expectedStationCount &&
      parsedTotalVoters === existing.registeredVoters;

    if (!exactMatch) {
      skippedIncomplete++;
      continue;
    }
    if (parsedStations.length === 1) {
      skippedAlreadyIndividual++;
      continue;
    }

    await db.$transaction([
      db.pollingStation.delete({ where: { id: existing.id } }),
      db.pollingStation.createMany({
        data: parsedStations.map(([code, name, voters]) => ({
          pollingCenterId: centre.id,
          code,
          name,
          registeredVoters: voters,
        })),
      }),
    ]);
    upgraded++;
  }

  console.log(`\nUpgraded ${upgraded} centres to their true individual polling stations.`);
  console.log(`Skipped ${skippedAlreadyIndividual} centres already correctly represented by one real station.`);
  console.log(`Skipped ${skippedIncomplete} centres where the parsed breakdown didn't exactly reconcile -- left as their existing combined aggregate.`);
  console.log(`Skipped ${skippedNoBreakdown} centres with no parsed breakdown available at all.`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
