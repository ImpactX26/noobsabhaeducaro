import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useApplicant } from "@/store/ApplicantContext";
import { requirementLabels } from "@/data/mockApplicant";
import { StatusIcon } from "@/components/StatusBadge";
import { Panel, Label, ActionButton } from "@/components/ui-blocks";

export default function Dashboard() {
  const { applicant, stats, openUpload } = useApplicant();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const q = applicant.qualification;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl uppercase md:text-6xl">{greet}, {applicant.profile.name.split(" ")[0]} <span style={{ fontFamily: "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'" }}>👋</span></h1>
        <p className="mt-2 text-sieg-white/60">Let's get you one step closer to Germany.</p>
      </div>

      <Panel>
        <Label>Your Germany journey</Label>
        <p className="font-display mt-3 text-5xl">{stats.done}<span className="text-sieg-red"> / {stats.total}</span> <span className="text-2xl uppercase">steps completed</span></p>
        <div className="mt-4 h-2 bg-sieg-white/10"><div className="h-full bg-sieg-red transition-all duration-1000" style={{ width: `${stats.profilePct}%` }} /></div>
      </Panel>

      {stats.complete ? (
        <div className="bg-sieg-success p-8 text-sieg-white">
          <CheckCircle2 className="h-10 w-10" />
          <p className="font-display mt-4 text-3xl uppercase md:text-5xl">Your documents are complete.</p>
          <p className="mt-3 max-w-xl">Recommended next step: explore suitable German universities and programs.</p>
          <div className="mt-6"><ActionButton to="/next-steps" dark>Explore universities</ActionButton></div>
        </div>
      ) : (
        <div className="bg-sieg-yellow p-8 text-sieg-black">
          <Label className="text-sieg-black/70">Your next step</Label>
          <p className="font-display mt-3 flex items-start gap-3 text-3xl uppercase md:text-5xl"><AlertTriangle className="mt-1 h-8 w-8 shrink-0 text-sieg-red" />Upload your {(stats.nextMissing?.name ?? "documents").toLowerCase()}</p>
          <p className="mt-4 max-w-2xl">{stats.done} of {stats.total} requirements are done. This is the fastest way to move your application forward.</p>
          <div className="mt-6"><ActionButton onClick={() => openUpload(stats.nextMissing?.type)} dark>Upload now</ActionButton> <ActionButton to="/chat">Ask the AI advisor</ActionButton></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <Label>Application status</Label>
          <p className="font-display mt-3 text-3xl uppercase">{stats.statusLabel}</p>
          <p className="text-sm text-sieg-white/60">{stats.done} of {stats.total} requirements completed</p>
          <ul className="mt-5 space-y-3">
            {(["degree", "marks", "supportingDocuments", "languageCertificate"] as const).map((k) => (
              <li key={k} className="flex items-center gap-3"><StatusIcon status={q[k]} />{requirementLabels[k]}</li>
            ))}
          </ul>
        </Panel>
        <Panel className="border-sieg-red">
          <Label className="text-sieg-yellow">✦ sieg.ai insight</Label>
          <p className="mt-4 text-xl font-medium">
            {stats.complete
              ? "All required documents are verified. Exploring universities that match your background is the best next move."
              : `Next up: your ${(stats.nextMissing?.name ?? "documents").toLowerCase()}. Ask the AI advisor anything about your path to Germany.`}
          </p>
          <Label className="mt-6">Last analyzed: Just now</Label>
        </Panel>
        <Panel>
          <Label>Your documents</Label>
          <ul className="mt-5 space-y-3">
            {applicant.documents.map((d) => <li key={d.id} className="flex items-center gap-3"><StatusIcon status={d.status} />{d.name}</li>)}
          </ul>
          <div className="mt-6"><ActionButton to="/documents">View all documents</ActionButton></div>
        </Panel>
        <Panel>
          <Label>Profile completeness</Label>
          <p className="font-display mt-3 text-7xl text-sieg-yellow">{stats.profilePct}%</p>
          <p className="text-sieg-white/60">{stats.complete ? "Your profile is complete." : "Your profile is almost complete."}</p>
          <div className="mt-6"><ActionButton to="/profile">View my profile</ActionButton></div>
        </Panel>
      </div>
    </div>
  );
}
