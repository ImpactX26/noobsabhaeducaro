import type { Applicant } from "@/types/applicant";

export const requirementLabels: Record<keyof Applicant["qualification"], string> = {
  degree: "Degree",
  marks: "Academic Marks",
  languageCertificate: "Language Certificate",
  workExperience: "Work Experience",
  supportingDocuments: "Supporting Documents",
};
