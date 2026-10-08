import { cn } from "@/lib/utils";

/** Always lowercase "sieg.ai": si = black (or white on dark), eg = red, ai = yellow */
export function SiegLogo({ className, onDark = true, egClassName }: { className?: string; onDark?: boolean; egClassName?: string }) {
  return (
    <span className={cn("font-display lowercase tracking-tight leading-none", className)} aria-label="sieg.ai">
      <span className={onDark ? "text-sieg-white" : "text-sieg-black"}>si</span>
      <span className={cn("text-sieg-red", egClassName)}>{'eg'}</span>
      <span className={onDark ? "text-sieg-white" : "text-sieg-black"}>.</span>
      <span className="text-sieg-yellow">ai</span>
    </span>
  );
}
