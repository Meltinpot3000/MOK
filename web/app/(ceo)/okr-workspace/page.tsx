import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

/** @deprecated Nutzen Sie `/okr/planning` (Tabs unter `/okr`). */
export default async function OkrWorkspacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.okrCycle?.trim();
  redirect(q ? `/okr/planning?okrCycle=${encodeURIComponent(q)}` : "/okr/planning");
}
