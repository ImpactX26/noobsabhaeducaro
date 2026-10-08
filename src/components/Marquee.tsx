import { cn } from "@/lib/utils";

export function Marquee({ items, reverse, speed = 40, className, itemClass }: { items: string[]; reverse?: boolean; speed?: number; className?: string; itemClass?: string }) {
  const all = [...items, ...items];
  return (
    <div className={cn("marquee overflow-hidden", className)}>
      <div className={cn("marquee-track", reverse && "reverse")} style={{ ["--speed" as string]: `${speed}s` }}>
        {all.map((n, i) => (
          <span key={i} className={cn("font-display flex shrink-0 items-center whitespace-nowrap px-8 text-3xl uppercase md:text-5xl", itemClass)}>
            {n}<span className="ml-16 text-sieg-red">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
