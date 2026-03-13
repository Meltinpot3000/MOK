export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-zinc-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-zinc-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-80 animate-pulse rounded-xl bg-zinc-200" />
      </div>
    </div>
  );
}
