CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  nationality text NOT NULL DEFAULT '',
  degree text NOT NULL DEFAULT '',
  field text NOT NULL DEFAULT '',
  university text NOT NULL DEFAULT '',
  graduation_year int,
  marks numeric,
  total_experience text NOT NULL DEFAULT '',
  relevant_experience text NOT NULL DEFAULT '',
  latest_organisation text NOT NULL DEFAULT '',
  english text NOT NULL DEFAULT '',
  german text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT 'Higher studies in Germany',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  ai_summary text,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs select" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own docs insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own docs update" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own docs delete" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX documents_user_idx ON public.documents(user_id, created_at);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat select" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own chat delete" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX chat_user_idx ON public.chat_messages(user_id, created_at);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "own files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);