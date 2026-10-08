import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PageHeader = ({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) => (
  <div className="mb-10">
    {badge && <span className="font-mono-label bg-sieg-yellow px-2 py-1 text-[10px] font-bold text-sieg-black">{badge}</span>}
    <h1 className="font-display mt-4 text-5xl uppercase md:text-7xl">{title}</h1>
    <p className="mt-3 max-w-xl text-sieg-white/60">{subtitle}</p>
  </div>
);

export const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("border border-sieg-white/15 bg-sieg-black p-6 transition-transform hover:-translate-y-0.5", className)}>{children}</div>
);

export const Label = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("font-mono-label block text-[10px] text-sieg-white/50", className)}>{children}</span>
);

export const ActionButton = ({ children, onClick, to, dark }: { children: ReactNode; onClick?: () => void; to?: string; dark?: boolean }) => {
  const cls = cn("font-mono-label group inline-flex items-center gap-3 px-5 py-3.5 text-xs font-bold transition-transform hover:-translate-y-0.5", dark ? "bg-sieg-black text-sieg-yellow" : "bg-sieg-yellow text-sieg-black");
  const inner = <>{children}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>;
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
};
