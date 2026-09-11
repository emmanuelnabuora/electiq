"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { SCENARIO_MODEL_VERSION } from "@/lib/scenarios/model";
import { getRemainingReportProjection } from "@/lib/scenarios/remaining-report";
import { getTurnoutScenario } from "@/lib/scenarios/turnout-scenario";
import { getSwingScenario } from "@/lib/scenarios/swing-scenario";
import { getRunoffScenario } from "@/lib/scenarios/runoff-scenario";
import type { Prisma } from "@/generated/prisma/client";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

/**
 * Every branch here computes a result, then persists it with exactly the
 * fields Section 9 requires (model version, assumptions, execution time,
 * confidence note) before returning — a scenario is never shown without
 * first being recorded, the same "audit before display" posture as every
 * other feature in this app.
 */
export async function runScenario(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "results", "read");

  const electionId = str(formData, "electionId");
  const positionName = str(formData, "positionName");
  const scenarioType = str(formData, "scenarioType") as
    | "REMAINING_REPORT"
    | "TURNOUT_ADJUSTMENT"
    | "SWING_ADJUSTMENT"
    | "RUNOFF";

  let result: unknown;
  let assumptions: Prisma.InputJsonObject;
  let confidenceNote: string;

  if (scenarioType === "REMAINING_REPORT") {
    result = await getRemainingReportProjection(electionId, positionName);
    assumptions = {};
    confidenceNote =
      "Assumes unreported polling stations will show the same turnout rate and candidate vote shares as those already reported. Real remaining stations may differ significantly, especially if concentrated in particular regions.";
  } else if (scenarioType === "TURNOUT_ADJUSTMENT") {
    const turnoutDeltaPct = Number(str(formData, "turnoutDeltaPct"));
    result = await getTurnoutScenario(electionId, positionName, turnoutDeltaPct);
    assumptions = { turnoutDeltaPct };
    confidenceNote =
      "Assumes every candidate's vote share stays exactly the same as turnout changes. In reality, turnout changes often favor some candidates more than others.";
  } else if (scenarioType === "SWING_ADJUSTMENT") {
    const targetParty = str(formData, "targetParty");
    const swingDeltaPct = Number(str(formData, "swingDeltaPct"));
    result = await getSwingScenario(electionId, positionName, targetParty, swingDeltaPct);
    assumptions = { targetParty, swingDeltaPct };
    confidenceNote =
      "Assumes the modeled swing applies uniformly across all polling stations and constituencies. Real swings are rarely uniform — some areas may swing much more or less than others, or in the opposite direction.";
  } else if (scenarioType === "RUNOFF") {
    result = await getRunoffScenario(electionId, positionName);
    assumptions = {};
    confidenceNote =
      "Redistributes eliminated candidates' votes to the top two in proportion to their current standing relative to each other — a simplifying assumption. Real runoff voters' second-choice preferences could differ substantially.";
  } else {
    throw new ActionError(`Unknown scenario type: ${scenarioType}`);
  }

  const run = await db.scenarioRun.create({
    data: {
      electionId,
      positionName,
      scenarioType,
      modelVersion: SCENARIO_MODEL_VERSION,
      assumptions,
      result: result as Prisma.InputJsonValue,
      confidenceNote,
      executedById: session.user.id,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "SCENARIO_RUN_CREATED",
    entityType: "ScenarioRun",
    entityId: run.id,
    newState: { scenarioType, positionName },
  });

  revalidatePath("/command-center/scenarios");
  return {
    id: run.id,
    scenarioType: run.scenarioType,
    modelVersion: run.modelVersion,
    result,
    confidenceNote: run.confidenceNote,
    executedAt: run.executedAt.toISOString(),
  };
}
