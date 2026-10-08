import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useApplicant } from "@/store/ApplicantContext";
import { PageHeader, Label, ActionButton } from "@/components/ui-blocks";
import { Marquee } from "@/components/Marquee";

const unis = ["RWTH Aachen University", "Technical University of Munich", "TU Berlin", "KIT", "TU Darmstadt", "University of Stuttgart"];

export default function NextSteps() {
  const { stats, openUpload } = useApplicant();
  return (
    <>
      <PageHeader title="What should I do?" subtitle="Based on your documents and qualification check, here's your next step." />
      {stats.complete ? (
        <>
          <div className="bg-sieg-success p-8 md:p-12">
            <CheckCircle2 className="h-12 w-12 animate-in zoom-in duration-500" />
            <p className="font-display mt-6 text-4xl uppercase md:text-6xl">Your documents are complete.</p>
          </div>
          <div className="mt-6 bg-sieg-yellow p-8 text-sieg-black md:p-12">
            <Label className="text-sieg-black/70">Recommended next step</Label>
            <p className="font-display mt-3 text-3xl uppercase md:text-5xl">Explore suitable German universities and programs.</p>
            <div className="mt-8"><ActionButton to="/#opportunities" dark>Explore universities</ActionButton></div>
          </div>
          <Label className="mt-10">Universities to explore</Label>
          <Marquee items={unis} speed={35} className="mt-3 border-y border-sieg-white/10 py-4" itemClass="text-2xl md:text-3xl" />
        </>
      ) : (
        <div className="bg-sieg-red p-8 md:p-12">
          <AlertTriangle className="h-12 w-12 text-sieg-yellow" />
          <p className="font-display mt-6 text-4xl uppercase md:text-6xl">Your {(stats.nextMissing?.name ?? "document").toLowerCase()} is missing.</p>
          <p className="mt-6 max-w-xl text-lg">Upload it so sieg.ai can verify your qualification and update your application status.</p>
          <div className="mt-8"><ActionButton onClick={() => openUpload(stats.nextMissing?.type)}>Upload now</ActionButton></div>
        </div>
      )}
      <Label className="mt-8">✦ Based on your uploaded documents · Last analyzed: Just now</Label>
    </>
  );
}
