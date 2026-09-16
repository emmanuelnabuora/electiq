/**
 * Removes ResultSubmission rows (and their CandidateResult children) that
 * were created by a real bug in prisma/seed.ts's publishResultsForElection:
 * it queried every polling station in the ENTIRE database with no country
 * filter, so once Kenya's real stations existed alongside the demo
 * election's own, every re-seed had a chance of attaching fake,
 * randomly-generated demo-election results to real Kenya stations.
 *
 * This only deletes a ResultSubmission where its election's country does
 * NOT match its polling station's actual country -- the exact signature
 * of this bug's output. A correctly-scoped submission (election and
 * station genuinely in the same country) is never touched.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/cleanup-cross-country-results.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const mismatched = await db.$queryRaw<Array<{ id: string }>>`
    SELECT rs.id
    FROM result_submissions rs
    JOIN elections e ON e.id = rs."electionId"
    JOIN polling_stations ps ON ps.id = rs."pollingStationId"
    JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
    JOIN administrative_units au ON au.id = pc."unitId"
    JOIN administrative_levels al ON al.id = au."levelId"
    WHERE al."countryId" != e."countryId"
  `;

  console.log(`Found ${mismatched.length} result submissions attached to a station outside their election's own country.`);

  if (mismatched.length === 0) {
    console.log("Nothing to clean up.");
    await db.$disconnect();
    return;
  }

  const ids = mismatched.map((r) => r.id);
  const deletedResults = await db.candidateResult.deleteMany({ where: { submissionId: { in: ids } } });
  const deletedSubmissions = await db.resultSubmission.deleteMany({ where: { id: { in: ids } } });

  console.log(`Deleted ${deletedResults.count} candidate results and ${deletedSubmissions.count} result submissions.`);
  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
