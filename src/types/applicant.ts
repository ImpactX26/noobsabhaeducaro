export type DocStatus = "processed" | "missing" | "verified" | "unknown" | "processing" | "rejected" | "conflict";
export type ReqStatus = "verified" | "missing" | "not_required" | "conflict";
export type DocType = "10th" | "12th" | "degree" | "resume" | "language" | "other";

export interface ApplicantDocument {
  id: string;
  /** Slot type, e.g. "degree" */
  type: DocType;
  /** Database row id when an upload exists */
  rowId?: string;
  name: string;
  status: DocStatus;
  summary?: string | null;
  issues?: string[];
  storagePath?: string;
}

export interface Applicant {
  profile: {
    name: string;
    nationality: string;
    email: string;
    degree: string;
    field: string;
    university: string;
    graduationYear: number | null;
    marks: number | null;
    totalExperience: string;
    relevantExperience: string;
    latestOrganisation: string;
    english: string;
    german: string;
    target: string;
  };
  documents: ApplicantDocument[];
  qualification: {
    degree: ReqStatus;
    marks: ReqStatus;
    languageCertificate: ReqStatus;
    workExperience: ReqStatus;
    supportingDocuments: ReqStatus;
  };
  conflicts: { id: string; title: string; detail: string; type: DocType }[];
}
