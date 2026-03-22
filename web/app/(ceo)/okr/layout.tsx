import { OkrSectionNav } from "@/components/ceo/okr/OkrSectionNav";

export default function OkrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="brand-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Bereich</p>
        <OkrSectionNav />
      </div>
      {children}
    </div>
  );
}
