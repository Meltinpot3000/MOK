import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/ceo/queries";
import { getPostLoginRedirectPath } from "@/lib/rbac/page-access";

export default async function Home() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }
  redirect(await getPostLoginRedirectPath(userId));
}
