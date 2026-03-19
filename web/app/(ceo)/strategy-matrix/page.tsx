import { StrategyMatrixView } from "@/app/(ceo)/strategy-matrix/StrategyMatrixView";

type StrategyMatrixPageProps = {
  searchParams: Promise<{ drawer_direction_id?: string }>;
};

export default async function StrategyMatrixPage({ searchParams }: StrategyMatrixPageProps) {
  const resolvedSearchParams = await searchParams;
  return <StrategyMatrixView drawerDirectionId={resolvedSearchParams.drawer_direction_id ?? null} />;
}
