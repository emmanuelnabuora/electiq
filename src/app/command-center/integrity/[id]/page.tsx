import { redirect } from "next/navigation";

// Moved to /integrity/[id] as part of the UI redesign.
export default async function LegacyIntegrityDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/integrity/${id}`);
}
