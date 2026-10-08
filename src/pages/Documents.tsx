import { FileText, Trash2, Eye, Upload } from "lucide-react";
import { useApplicant } from "@/store/ApplicantContext";
import { StatusIcon, StatusBadge } from "@/components/StatusBadge";
import { PageHeader, ActionButton } from "@/components/ui-blocks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Documents() {
  const { applicant, openUpload, deleteDocument } = useApplicant();

  const view = async (path?: string) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 120);
    if (error || !data) return toast.error("Could not open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <>
      <PageHeader title="Your documents" subtitle="Everything sieg.ai is using to understand your application." />
      <ul className="divide-y divide-sieg-white/10 border border-sieg-white/15 bg-sieg-black">
        {applicant.documents.map((d) => (
          <li key={d.id} className="p-5 transition-colors hover:bg-sieg-white/5">
            <div className="flex flex-wrap items-center gap-4">
              <StatusIcon status={d.status} />
              <FileText className="h-5 w-5 text-sieg-white/40" />
              <span className="min-w-0 flex-1 truncate font-semibold">{d.name}</span>
              <StatusBadge status={d.status} label={d.status === "verified" ? "✦ AI verified" : undefined} />
              <div className="flex gap-2">
                {d.rowId && <button aria-label="View" onClick={() => view(d.storagePath)} className="p-2 text-sieg-white/60 hover:text-sieg-yellow"><Eye className="h-4 w-4" /></button>}
                <button aria-label="Upload" onClick={() => openUpload(d.type)} className="p-2 text-sieg-white/60 hover:text-sieg-yellow"><Upload className="h-4 w-4" /></button>
                {d.rowId && <button aria-label="Delete" onClick={() => confirm("Delete this document?") && deleteDocument(d.rowId!, d.storagePath)} className="p-2 text-sieg-white/60 hover:text-sieg-red"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
            {d.summary && <p className="mt-3 pl-11 text-sm text-sieg-white/60">✦ {d.summary}</p>}
            {!!d.issues?.length && <ul className="mt-2 pl-11 text-sm text-sieg-yellow">{d.issues.map((i) => <li key={i}>• {i}</li>)}</ul>}
          </li>
        ))}
      </ul>
      <div className="mt-8"><ActionButton onClick={() => openUpload()}>+ Upload document</ActionButton></div>
    </>
  );
}
