import { redirect } from "next/navigation";

export default async function AnnualTargetsPage() {
  redirect("/reviews?tab=overview");
}
