import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy-Pfad: Strategy Review liegt unter dem Reviewzyklus. */
export default async function OkrStrategyReviewRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value) && value[0]) sp.set(key, value[0]);
  }
  const q = sp.toString();
  redirect(q ? `/reviews/strategy-review?${q}` : "/reviews/strategy-review");
}
