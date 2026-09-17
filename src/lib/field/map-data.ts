import { db } from "@/lib/db";

export type CheckInPoint = {
  id: string;
  observerName: string;
  stationName: string;
  stationCode: string;
  latitude: number;
  longitude: number;
  checkedInAt: string;
};

export type FieldReportPoint = {
  id: string;
  type: string;
  stationName: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
};

export type IncidentPoint = {
  id: string;
  title: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

/**
 * Real map data for the Field Operations screen -- observer check-ins,
 * field reports, and incidents that actually have coordinates,
 * scoped to the given election's own country (same rule as every other
 * geography query in this project). Rows without coordinates are
 * simply excluded rather than plotted at a fabricated location.
 */
export async function getFieldOperationsMapData(electionId: string) {
  const election = await db.election.findUniqueOrThrow({ where: { id: electionId }, select: { countryId: true } });

  const [checkInRows, reportRows, incidentRows] = await Promise.all([
    db.observerAssignment.findMany({
      where: {
        checkedInAt: { not: null },
        checkInLatitude: { not: null },
        checkInLongitude: { not: null },
        pollingStation: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
      },
      include: { observer: { include: { user: { select: { name: true } } } }, pollingStation: true },
      orderBy: { checkedInAt: "desc" },
      take: 200,
    }),
    db.fieldReport.findMany({
      where: {
        electionId,
        gpsLatitude: { not: null },
        gpsLongitude: { not: null },
      },
      include: { assignment: { include: { pollingStation: true } } },
      orderBy: { submittedAt: "desc" },
      take: 200,
    }),
    db.incident.findMany({
      where: {
        electionId,
        gpsLatitude: { not: null },
        gpsLongitude: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const checkIns: CheckInPoint[] = checkInRows.map((a) => ({
    id: a.id,
    observerName: a.observer.user.name,
    stationName: a.pollingStation.name,
    stationCode: a.pollingStation.code,
    latitude: a.checkInLatitude!,
    longitude: a.checkInLongitude!,
    checkedInAt: a.checkedInAt!.toISOString(),
  }));

  const reports: FieldReportPoint[] = reportRows.map((r) => ({
    id: r.id,
    type: r.type,
    stationName: r.assignment.pollingStation.name,
    latitude: r.gpsLatitude!,
    longitude: r.gpsLongitude!,
    submittedAt: r.submittedAt.toISOString(),
  }));

  const incidents: IncidentPoint[] = incidentRows.map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    status: i.status,
    latitude: i.gpsLatitude!,
    longitude: i.gpsLongitude!,
    createdAt: i.createdAt.toISOString(),
  }));

  return { checkIns, reports, incidents };
}
