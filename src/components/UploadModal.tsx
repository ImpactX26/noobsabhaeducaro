import { useRef, useState, DragEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload, FileText, Check, Loader2, AlertTriangle, X } from "lucide-react";
import { uploadSteps, docSlots, docTypeLabel } from "@/services/applicantService";
import { useApplicant } from "@/store/ApplicantContext";
import type { DocType } from "@/types/applicant";
import { cn } from "@/lib/utils";

const MAX = 10 * 1024 * 1024;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"];

type Result = { status: string; summary?: string; issues?: string[] };

export function UploadModal({ type, onClose }: { type: DocType | null; onClose: () => void }) {
  const { uploadDocument } = useApplicant();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<DocType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);
  const docType = chosen ?? type ?? "other";
  const label = docTypeLabel(docType);

  const reset = () => { setFile(null); setStep(-1); setError(""); setResult(null); setChosen(null); };

  const pick = async (f?: File) => {
    if (!f) return;
    setError("");
    if (!OK_TYPES.includes(f.type)) return setError("Please upload a PDF, JPG or PNG file.");
    if (f.size > MAX) return setError("File is larger than 10 MB.");
    setFile(f);
    try {
      setResult(await uploadDocument(f, docType, setStep));
    } catch (e) {
      setError((e as Error).message);
      setFile(null); setStep(-1);
    }
  };

  const close = (o: boolean) => { if (!o) { onClose(); setTimeout(reset, 300); } };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); };
  const pct = step < 0 ? 0 : Math.round(((step + 1) / uploadSteps.length) * 100);
  const ok = result?.status === "verified";

  return (
    <Dialog open={type !== null} onOpenChange={close}>
      <DialogContent className="max-w-lg border-2 border-sieg-yellow bg-sieg-ink p-0 text-sieg-white sm:rounded-none">
        {result ? (
          <div className={cn("p-10 text-center", ok ? "bg-sieg-yellow text-sieg-black" : "bg-sieg-black text-sieg-white")}>
            <div className={cn("mx-auto mb-6 flex h-20 w-20 items-center justify-center animate-in zoom-in duration-500", ok ? "bg-sieg-black text-sieg-yellow" : "bg-sieg-red text-sieg-white")}>
              {ok ? <Check className="h-10 w-10" strokeWidth={3} /> : result.status === "rejected" ? <X className="h-10 w-10" strokeWidth={3} /> : <AlertTriangle className="h-10 w-10" />}
            </div>
            <DialogTitle className="font-display text-4xl uppercase">
              {ok ? `${label} verified!` : result.status === "rejected" ? "Not the right document" : "Needs attention"}
            </DialogTitle>
            <DialogDescription className={cn("mt-4", ok ? "text-sieg-black/80" : "text-sieg-white/70")}>{result.summary}</DialogDescription>
            {!!result.issues?.length && (
              <ul className="mt-4 space-y-1 text-left text-sm">{result.issues.map((i) => <li key={i}>• {i}</li>)}</ul>
            )}
            <p className="font-mono-label mt-4 text-[10px]">✦ AI analyzed · Just now</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {!ok && <button onClick={() => { const t = docType; reset(); setChosen(t); }} className="font-mono-label bg-sieg-yellow px-6 py-4 text-xs font-bold text-sieg-black hover:bg-sieg-white">Upload again</button>}
              <button onClick={() => close(false)} className={cn("font-mono-label px-6 py-4 text-xs font-bold", ok ? "bg-sieg-black text-sieg-yellow hover:bg-sieg-red hover:text-sieg-white" : "border border-sieg-white/30 hover:bg-sieg-white/10")}>
                See updated journey →
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <p className="font-mono-label text-[10px] text-sieg-yellow">✦ AI document check</p>
            <DialogTitle className="font-display mt-3 text-3xl uppercase">Upload {label}</DialogTitle>
            <DialogDescription className="mt-2 text-sieg-white/60">sieg.ai reads it, checks it and updates your profile.</DialogDescription>

            {!file && (
              <div className="mt-5 flex flex-wrap gap-2">
                {[...docSlots, { type: "other" as DocType, label: "Other" }].map((s) => (
                  <button key={s.type} onClick={() => setChosen(s.type)} className={cn("font-mono-label px-3 py-2 text-[10px]", docType === s.type ? "bg-sieg-red text-sieg-white" : "bg-sieg-white/10 hover:bg-sieg-white/20")}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={cn("mt-6 border-2 border-dashed p-10 text-center transition-colors", drag ? "border-sieg-yellow bg-sieg-yellow/10" : "border-sieg-white/30")}
              >
                <Upload className="mx-auto h-10 w-10 text-sieg-red" />
                <p className="font-display mt-4 text-xl uppercase">Drop your file here</p>
                <p className="mt-2 text-sm text-sieg-white/50">or</p>
                <button onClick={() => input.current?.click()} className="font-mono-label mt-3 bg-sieg-yellow px-5 py-3 text-xs font-bold text-sieg-black hover:bg-sieg-white">
                  Browse files
                </button>
                <p className="font-mono-label mt-5 text-[10px] text-sieg-white/40">PDF, JPG, PNG · Max 10 MB</p>
                <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </div>
            ) : (
              <div className="mt-6 border border-sieg-white/20 p-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-sieg-yellow" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{file.name}</p>
                    <p className="font-mono-label text-[10px] text-sieg-white/50">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <span className="font-display text-2xl text-sieg-yellow">{pct}%</span>
                </div>
                <div className="mt-4 h-1.5 bg-sieg-white/10"><div className="h-full bg-sieg-red transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                <ul className="mt-5 space-y-2">
                  {uploadSteps.slice(0, -1).map((s, i) => (
                    <li key={s} className={cn("font-mono-label flex items-center gap-2 text-[11px]", i < step ? "text-sieg-white" : i === step ? "text-sieg-yellow" : "text-sieg-white/30")}>
                      {i < step ? <Check className="h-3 w-3" /> : i === step ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-3 w-3" />}
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p className="mt-4 bg-sieg-red p-3 text-sm">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
