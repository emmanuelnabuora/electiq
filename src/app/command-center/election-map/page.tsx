import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { ElectionMap } from "@/components/map/election-map-loader";

export default async function ElectionMapPage() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view the election map (
          <code>elections.read</code>).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Election Map</h1>
        <p className="text-sm text-neutral">
          Registered voters by region, with drill-down into constituencies and wards.
        </p>
      </div>
      <ElectionMap />
    </div>
  );
}
