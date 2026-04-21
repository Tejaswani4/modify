
-- Roles enum + table (separate, to avoid privilege escalation)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  happiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_smile_at TIMESTAMPTZ,
  badges TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Smiles
CREATE TABLE public.smiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  happiness NUMERIC(4,3) NOT NULL,
  sadness NUMERIC(4,3) NOT NULL DEFAULT 0,
  anger NUMERIC(4,3) NOT NULL DEFAULT 0,
  surprise NUMERIC(4,3) NOT NULL DEFAULT 0,
  neutral NUMERIC(4,3) NOT NULL DEFAULT 0,
  mood TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  image_url TEXT,
  image_hash TEXT,
  is_genuine BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.smiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Smiles viewable by everyone" ON public.smiles FOR SELECT USING (true);
CREATE POLICY "Users insert own smiles" ON public.smiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own smiles" ON public.smiles FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_smiles_user_created ON public.smiles(user_id, created_at DESC);
CREATE INDEX idx_smiles_created ON public.smiles(created_at DESC);
CREATE INDEX idx_smiles_points ON public.smiles(points DESC);
CREATE INDEX idx_profiles_points ON public.profiles(total_points DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Smiler'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for smile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('smiles', 'smiles', true);

CREATE POLICY "Smile photos are publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'smiles');
CREATE POLICY "Users upload own smile photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'smiles' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own smile photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'smiles' AND auth.uid()::text = (storage.foldername(name))[1]);
