import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, User, FileText, ShieldCheck, Compass, MessageSquare, LogOut, Check } from "lucide-react";
import { useAuth } from "@/store/AuthContext";
import { SiegLogo } from "@/components/SiegLogo";
import { useApplicant } from "@/store/ApplicantContext";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/profile", label: "My Profile", Icon: User },
  { to: "/documents", label: "Documents", Icon: FileText },
  { to: "/qualification", label: "Qualification", Icon: ShieldCheck },
  { to: "/next-steps", label: "Next Steps", Icon: Compass },
  { to: "/chat", label: "AI Advisor", Icon: MessageSquare },
];

export function ProgressTracker() {
  const { stats, applicant } = useApplicant();
  const uploaded = applicant.documents.some((d) => d.rowId);
  const steps = ["Documents", "AI Analysis", "My Profile", "Qualification", "Next Steps"];
  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((s, i) => {
        const done = i < 2 ? uploaded : i < 4 ? stats.done >= stats.total - 1 : stats.complete;
        const current = !done && (i === 0 || i === 4);
        return (
          <li key={s} className={cn("p-2 md:p-3", done ? "bg-sieg-white/10" : current ? "bg-sieg-red" : "bg-sieg-yellow/20")}>
            <span className="font-mono-label flex items-center gap-1 text-[9px] md:text-[10px]">
              {done ? <Check className="h-3 w-3 text-sieg-yellow" strokeWidth={3} /> : `0${i + 1}`}
              <span className="hidden sm:inline">{s}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function AppLayout() {
  const { applicant } = useApplicant();
  const { signOut } = useAuth();
  const initials = applicant.profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-sieg-ink text-sieg-white md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sieg-white/10 bg-sieg-black p-6 md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/"><SiegLogo className="text-3xl" /></Link>
        <nav className="mt-12 flex flex-col gap-1">
          {nav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn("flex items-center gap-3 border-l-4 px-4 py-3 text-sm font-semibold transition-colors", isActive ? "border-sieg-red bg-sieg-white/5 text-sieg-yellow" : "border-transparent text-sieg-white/60 hover:text-sieg-white")}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-sieg-white/10 pt-6">
          <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center bg-sieg-red">{initials}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{applicant.profile.name}</span>
          <button aria-label="Log out" onClick={signOut} className="text-sieg-white/50 hover:text-sieg-red"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-sieg-white/10 px-5 py-4 md:px-10">
          <Link to="/" className="md:hidden"><SiegLogo className="text-2xl" /></Link>
          <span className="font-mono-label hidden text-[10px] text-sieg-white/50 md:block">✦ Based on your uploaded documents</span>
          <div className="flex items-center gap-4">
            <button aria-label="Log out" onClick={signOut} className="font-mono-label flex items-center gap-1 text-[10px] text-sieg-white/60 hover:text-sieg-red md:hidden"><LogOut className="h-4 w-4" /></button>
            <span className="font-display flex h-9 w-9 items-center justify-center bg-sieg-red text-sm">{initials}</span>
          </div>
        </header>
        <div className="px-5 pt-6 md:px-10"><ProgressTracker /></div>
        <main key={loc.pathname} className="animate-in fade-in slide-in-from-bottom-2 px-5 py-8 duration-500 md:px-10"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-sieg-white/10 bg-sieg-black md:hidden">
        {nav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn("flex flex-col items-center gap-1 py-3 text-[9px] font-semibold", isActive ? "text-sieg-yellow" : "text-sieg-white/50")}>
            <Icon className="h-4 w-4" />{label.replace("My ", "").replace("AI ", "")}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
