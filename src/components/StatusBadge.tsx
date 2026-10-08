import { Check, X, Minus, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocStatus, ReqStatus } from "@/types/applicant";

const map: Record<DocStatus | ReqStatus, { label: string; cls: string; Icon: typeof Check }> = {
  verified: { label: "OK", cls: "bg-sieg-success text-sieg-white", Icon: Check },
  processed: { label: "Processed", cls: "bg-sieg-success text-sieg-white", Icon: Check },
  missing: { label: "Missing", cls: "bg-sieg-red text-sieg-white", Icon: X },
  not_required: { label: "Not required", cls: "bg-sieg-white/10 text-sieg-white", Icon: Minus },
  conflict: { label: "Mismatch", cls: "bg-sieg-yellow text-sieg-black", Icon: AlertTriangle },
  processing: { label: "Analyzing", cls: "bg-sieg-white/10 text-sieg-yellow", Icon: Loader2 },
  rejected: { label: "Rejected", cls: "bg-sieg-red text-sieg-white", Icon: X },
  unknown: { label: "Unknown", cls: "bg-sieg-yellow text-sieg-black", Icon: HelpCircle },
};

export function StatusIcon({ status, className }: { status: DocStatus | ReqStatus; className?: string }) {
  const { cls, Icon } = map[status];
  return (
    <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center animate-in zoom-in duration-500", cls, className)}>
      <Icon className="h-4 w-4" strokeWidth={3} />
    </span>
  );
}

export function StatusBadge({ status, label }: { status: DocStatus | ReqStatus; label?: string }) {
  const { cls } = map[status];
  return <span className={cn("font-mono-label px-2 py-1 text-[10px] font-bold", cls)}>{label ?? map[status].label}</span>;
}
