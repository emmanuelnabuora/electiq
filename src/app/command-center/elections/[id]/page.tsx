import { redirect } from "next/navigation";

// Moved to /elections/[id] as part of the UI redesign, replacing this
// page in place. Redirect kept so old bookmarks/links still work.
export default async function LegacyElectionDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/elections/${id}`);
}
