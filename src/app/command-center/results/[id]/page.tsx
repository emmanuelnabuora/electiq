import { redirect } from "next/navigation";

// Moved to /results/submissions/[id] as part of the UI redesign.
export default async function LegacyResultDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/results/submissions/${id}`);
}
