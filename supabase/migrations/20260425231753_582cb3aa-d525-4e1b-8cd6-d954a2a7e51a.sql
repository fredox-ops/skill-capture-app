-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'policymaker', 'user');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security-definer helper to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. RLS for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Allow policymakers/admins to read all analyses (for aggregate dashboard)
CREATE POLICY "Policymakers can view all analyses"
ON public.analyses
FOR SELECT
USING (
  public.has_role(auth.uid(), 'policymaker')
  OR public.has_role(auth.uid(), 'admin')
);

-- 6. Allow policymakers/admins to read all profiles (for country-level aggregation)
CREATE POLICY "Policymakers can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'policymaker')
  OR public.has_role(auth.uid(), 'admin')
);