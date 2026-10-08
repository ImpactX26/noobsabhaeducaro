import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from "react";
import type { Applicant, DocType } from "@/types/applicant";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { buildApplicant, computeStats } from "@/services/applicantService";
import { UploadModal } from "@/components/UploadModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/AuthContext";
import { toast } from "sonner";

interface Ctx {
  applicant: Applicant;
  stats: ReturnType<typeof computeStats>;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: TablesUpdate<"profiles">) => Promise<boolean>;
  uploadDocument: (file: File, type: DocType, onStep: (i: number) => void) => Promise<{ status: string; summary?: string; issues?: string[] }>;
  deleteDocument: (rowId: string, path?: string) => Promise<void>;
  openUpload: (type?: DocType) => void;
}

const ApplicantContext = createContext<Ctx | null>(null);

export function ApplicantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [docs, setDocs] = useState<Tables<"documents">[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadType, setUploadType] = useState<DocType | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); setDocs([]); setLoading(false); return; }
    const [p, d] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("documents").select("*").eq("user_id", user.id).order("created_at"),
    ]);
    let prof = p.data;
    if (!prof && !p.error) {
      const ins = await supabase.from("profiles").insert({ id: user.id, email: user.email ?? "", full_name: user.user_metadata?.full_name ?? "" }).select().single();
      prof = ins.data;
    }
    setProfile(prof);
    setDocs(d.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  const applicant = useMemo(() => buildApplicant(profile, docs), [profile, docs]);

  const updateProfile = useCallback(async (patch: TablesUpdate<"profiles">) => {
    if (!user) return false;
    const { error } = await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) { toast.error("Could not save your profile."); return false; }
    await refresh();
    return true;
  }, [user, refresh]);

  const uploadDocument = useCallback<Ctx["uploadDocument"]>(async (file, type, onStep) => {
    if (!user) throw new Error("Please sign in");
    onStep(0);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${user.id}/${type}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
    if (up.error) throw new Error("Upload failed. Please try again.");
    const ins = await supabase.from("documents").insert({ user_id: user.id, doc_type: type, name: file.name, storage_path: path, status: "processing" }).select().single();
    if (ins.error || !ins.data) throw new Error("Could not save the document.");
    await refresh();
    onStep(1);
    const t1 = setTimeout(() => onStep(2), 2500);
    const t2 = setTimeout(() => onStep(3), 6000);
    const { data, error } = await supabase.functions.invoke("analyze-document", { body: { documentId: ins.data.id } });
    clearTimeout(t1); clearTimeout(t2);
    await refresh();
    if (error) {
      let msg = "AI analysis failed.";
      try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    onStep(4);
    return data;
  }, [user, refresh]);

  const deleteDocument = useCallback(async (rowId: string, path?: string) => {
    if (path) await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", rowId);
    if (error) toast.error("Could not delete the document.");
    await refresh();
  }, [refresh]);

  return (
    <ApplicantContext.Provider
      value={{
        applicant, stats: computeStats(applicant), loading, refresh, updateProfile, uploadDocument, deleteDocument,
        openUpload: (t) => setUploadType(typeof t === "string" ? t : computeStats(applicant).nextMissing?.type ?? "other"),
      }}
    >
      {children}
      <UploadModal type={uploadType} onClose={() => setUploadType(null)} />
    </ApplicantContext.Provider>
  );
}

export function useApplicant() {
  const c = useContext(ApplicantContext);
  if (!c) throw new Error("useApplicant must be used inside ApplicantProvider");
  return c;
}
