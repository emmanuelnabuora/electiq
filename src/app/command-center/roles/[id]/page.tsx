import { redirect } from "next/navigation";

// Moved to /users/roles/[id] as part of the UI redesign (Screen 7).
export default async function LegacyRoleDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/users/roles/${id}`);
}
