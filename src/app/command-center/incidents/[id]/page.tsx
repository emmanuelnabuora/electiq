import { redirect } from "next/navigation";

// Moved to /incidents/[id] as part of the UI redesign.
export default async function LegacyIncidentDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/incidents/${id}`);
}
