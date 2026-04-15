import type { ReactNode } from "react";

export default function OkrLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
