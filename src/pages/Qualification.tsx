import { AlertTriangle } from "lucide-react";
import { useApplicant } from "@/store/ApplicantContext";
import { requirementLabels } from "@/data/mockApplicant";
import { StatusIcon, StatusBadge } from "@/components/StatusBadge";
import { PageHeader, Label, ActionButton } from "@/components/ui-blocks";

export default function Qualification() {
  const { applicant, stats, openUpload } = useApplicant();
  const q = applicant.qualification;
  return (
    <>
      <PageHeader title="Qualification check" subtitle="We've checked your information against the requirements for your selected Germany pathway." />
      <Label className="mb-3">Target</Label>
      <p className="font-display mb-8 inline-block bg-sieg-red px-4 py-2 text-xl uppercase">{applicant.profile.target}</p>

      {applicant.conflicts.map((c) => (
        <div key={c.id} className="mb-6 flex items-center gap-4 bg-sieg-yellow p-5 text-sieg-black">
          <AlertTriangle /> <div className="flex-1"><p className="font-bold uppercase">{c.title}</p><p>{c.detail}</p></div>
          <button onClick={() => openUpload(c.type)} className="font-mono-label bg-sieg-black px-4 py-2 text-xs text-sieg-yellow">Re-upload →</button>
        </div>
      ))}

      <ul className="divide-y divide-sieg-white/10 border border-sieg-white/15 bg-sieg-black">
        {(Object.keys(q) as (keyof typeof q)[]).map((k) => (
          <li key={k} className="flex items-center gap-4 p-5">
            <StatusIcon status={q[k]} />
            <span className="font-display flex-1 text-xl uppercase">{requirementLabels[k]}</span>
            <StatusBadge status={q[k]} />
          </li>
        ))}
      </ul>

      <div className={`mt-8 p-8 ${stats.complete ? "bg-sieg-success" : "bg-sieg-yellow text-sieg-black"}`}>
        <Label className={stats.complete ? "text-sieg-white/80" : "text-sieg-black/70"}>Overall</Label>
        <p className="font-display mt-2 text-5xl uppercase">{stats.complete ? "Qualified." : "Almost there."}</p>
        <p className="font-mono-label mt-2 text-xs font-bold">{stats.done} / {stats.total} requirements completed</p>
        <p className="mt-4 max-w-xl">
          {stats.complete ? "You meet all the listed requirements. Time to explore universities and programs." : "You meet most of the requirements. Upload your language certificate to complete your profile."}
        </p>
        <div className="mt-6">
          {stats.complete ? <ActionButton to="/next-steps" dark>See next step</ActionButton> : <ActionButton onClick={() => openUpload(stats.nextMissing?.type)} dark>Complete profile</ActionButton>}
        </div>
      </div>
    </>
  );
}
