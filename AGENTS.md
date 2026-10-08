# AGENTS.md
- Per-applicant data (profiles, documents, chat_messages) lives in Lovable Cloud with RLS scoped to auth.uid(); ApplicantContext derives the UI `Applicant` shape from those rows via buildApplicant — keeps pages unaware of storage.
- AI runs only in edge functions (`chat` streams UI messages and saves history; `analyze-document` verifies uploads and fills empty profile fields) via shared helpers in supabase/functions/_shared — keeps keys and prompts server-side.
