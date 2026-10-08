import { useEffect, useState } from "react";
import { useApplicant } from "@/store/ApplicantContext";
import { PageHeader, Panel, Label } from "@/components/ui-blocks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Row = Tables<"profiles">;
type Key = keyof Row;

const groups: [string, [Key, string, ("text" | "number")?][]][] = [
  ["Personal information", [["full_name", "Name"], ["nationality", "Nationality"], ["email", "Email"]]],
  ["Education", [["degree", "Degree"], ["field", "Field"], ["university", "University"], ["graduation_year", "Graduation", "number"], ["marks", "Percentage", "number"]]],
  ["Experience", [["total_experience", "Total experience"], ["relevant_experience", "Relevant experience"], ["latest_organisation", "Latest organisation"]]],
  ["Language", [["english", "English"], ["german", "German"]]],
];

const targets = ["Higher studies in Germany", "Ausbildung in Germany", "Job in Germany"];

export default function MyProfile() {
  const { user } = useAuth();
  const { updateProfile, applicant } = useApplicant();
  const [row, setRow] = useState<Row | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setRow(data));
  }, [user, applicant]);

  const save = async () => {
    setSaving(true);
    const { id: _i, updated_at: _u, ...patch } = { ...row, ...draft } as Row;
    if (await updateProfile(patch)) { toast.success("Profile saved"); setEdit(false); setDraft({}); }
    setSaving(false);
  };

  const val = (k: Key) => (k in draft ? draft[k] : row?.[k]);
  const show = (k: Key, type?: string) => {
    const v = row?.[k];
    if (v === null || v === "" || v === undefined) return "Not provided";
    return k === "marks" ? `${v}%` : String(v);
  };
  const btn = "font-mono-label px-5 py-3 text-xs font-bold";

  return (
    <>
      <PageHeader title="My profile" subtitle="AI fills this in from your documents. You can edit anything." badge="✦ AI extracted" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={(val("target") as string) ?? targets[0]}
          disabled={!edit}
          onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
          className="font-display bg-sieg-red px-4 py-2 text-lg uppercase disabled:opacity-100"
        >
          {targets.map((t) => <option key={t} value={t} className="bg-sieg-black">{t}</option>)}
        </select>
        <span className="flex-1" />
        {edit ? (
          <>
            <button onClick={() => { setEdit(false); setDraft({}); }} className={`${btn} border border-sieg-white/30`}>Cancel</button>
            <button disabled={saving} onClick={save} className={`${btn} bg-sieg-yellow text-sieg-black disabled:opacity-50`}>{saving ? "Saving…" : "Save profile"}</button>
          </>
        ) : (
          <button onClick={() => setEdit(true)} className={`${btn} bg-sieg-yellow text-sieg-black hover:bg-sieg-white`}>Edit profile</button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map(([title, rows]) => (
          <Panel key={title}>
            <Label className="text-sieg-yellow">{title}</Label>
            <dl className="mt-4">
              {rows.map(([k, label, type]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-sieg-white/10 py-3">
                  <dt className="text-sieg-white/50">{label}</dt>
                  {edit ? (
                    <input
                      type={type ?? "text"}
                      value={(val(k) as string | number | null) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }))}
                      className="w-1/2 border border-sieg-white/20 bg-transparent px-2 py-1 text-right outline-none focus:border-sieg-yellow"
                    />
                  ) : (
                    <dd className={show(k) === "Not provided" ? "text-sieg-red" : "text-right font-semibold"}>{show(k, type)}</dd>
                  )}
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </>
  );
}
