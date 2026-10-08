import type { Applicant, ApplicantDocument, DocType, ReqStatus } from "@/types/applicant";
import type { Tables } from "@/integrations/supabase/types";

export const uploadSteps = [
  "UPLOADING...",
  "READING DOCUMENT...",
  "EXTRACTING INFORMATION...",
  "VERIFYING WITH AI...",
  "COMPLETE",
] as const;

export const docSlots: { type: DocType; label: string }[] = [
  { type: "10th", label: "10th Marksheet" },
  { type: "12th", label: "12th Marksheet" },
  { type: "degree", label: "Degree Certificate" },
  { type: "resume", label: "Resume / CV" },
  { type: "language", label: "Language Certificate" },
];

export const docTypeLabel = (t: DocType) => docSlots.find((s) => s.type === t)?.label ?? "Supporting document";

type ProfileRow = Tables<"profiles">;
type DocRow = Tables<"documents">;

const req = (s?: string): ReqStatus => (s === "verified" ? "verified" : s === "conflict" ? "conflict" : "missing");

export function buildApplicant(p: ProfileRow | null, rows: DocRow[]): Applicant {
  const latest = (t: DocType) => rows.filter((r) => r.doc_type === t).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const toDoc = (r: DocRow, label?: string): ApplicantDocument => ({
    id: r.id, rowId: r.id, type: r.doc_type as DocType, name: r.name || label || "Document",
    status: r.status as ApplicantDocument["status"], summary: r.ai_summary,
    issues: Array.isArray(r.issues) ? (r.issues as string[]) : [], storagePath: r.storage_path,
  });
  const documents: ApplicantDocument[] = docSlots.map(({ type, label }) => {
    const r = latest(type);
    return r ? toDoc(r, label) : { id: type, type, name: label, status: "missing" };
  });
  rows.filter((r) => r.doc_type === "other").forEach((r) => documents.push(toDoc(r)));

  const st = (t: DocType) => latest(t)?.status;
  const marks: ReqStatus =
    st("10th") === "conflict" || st("12th") === "conflict" ? "conflict"
    : st("10th") === "verified" && st("12th") === "verified" ? "verified" : "missing";
  const target = p?.target ?? "Higher studies in Germany";

  return {
    profile: {
      name: p?.full_name || "Applicant",
      nationality: p?.nationality || "Not provided",
      email: p?.email || "",
      degree: p?.degree || "Not provided",
      field: p?.field || "Not provided",
      university: p?.university || "Not provided",
      graduationYear: p?.graduation_year ?? null,
      marks: p?.marks ?? null,
      totalExperience: p?.total_experience || "Not provided",
      relevantExperience: p?.relevant_experience || "Not provided",
      latestOrganisation: p?.latest_organisation || "Not provided",
      english: p?.english || "Not provided",
      german: p?.german || "Not provided",
      target,
    },
    documents,
    qualification: {
      degree: req(st("degree")),
      marks,
      languageCertificate: req(st("language")),
      workExperience: /job/i.test(target) ? (p?.total_experience ? "verified" : "missing") : "not_required",
      supportingDocuments: req(st("resume")),
    },
    conflicts: documents
      .filter((d) => d.status === "conflict" && d.issues?.length)
      .map((d) => ({ id: d.id, type: d.type, title: `${docTypeLabel(d.type)} needs attention`, detail: d.issues!.join(" · ") })),
  };
}

export function computeStats(a: Applicant) {
  const reqs = Object.values(a.qualification);
  const done = reqs.filter((s) => s === "verified" || s === "not_required").length;
  const total = reqs.length;
  const complete = done === total;
  const nextMissing = a.documents.find((d) => d.type !== "other" && d.status !== "verified" && d.status !== "processing");
  return {
    done,
    total,
    complete,
    nextMissing,
    profilePct: Math.round((done / total) * 100),
    statusLabel: complete ? "Complete" : done >= total - 1 ? "Almost Complete" : "In progress",
  };
}
