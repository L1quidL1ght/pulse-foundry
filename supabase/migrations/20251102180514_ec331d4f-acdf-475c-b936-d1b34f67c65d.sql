-- Add user_id to pulse_reports to track ownership
ALTER TABLE public.pulse_reports 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add status and notes columns for workflow management
ALTER TABLE public.pulse_reports 
ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
ADD COLUMN notes text;

-- Create user roles enum and table for admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop existing RLS policies on pulse_reports
DROP POLICY IF EXISTS "allow anon insert" ON public.pulse_reports;
DROP POLICY IF EXISTS "auth users can use reports" ON public.pulse_reports;

-- New RLS policies for pulse_reports
-- Allow anonymous inserts for public uploads (can be removed later if only auth uploads)
CREATE POLICY "anon_can_insert_reports"
ON public.pulse_reports
FOR INSERT
TO anon
WITH CHECK (true);

-- Users can view only their own reports
CREATE POLICY "users_view_own_reports"
ON public.pulse_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own reports
CREATE POLICY "users_update_own_reports"
ON public.pulse_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "users_delete_own_reports"
ON public.pulse_reports
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own reports
CREATE POLICY "users_insert_own_reports"
ON public.pulse_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "admins_full_access"
ON public.pulse_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS policy for user_roles table
CREATE POLICY "users_view_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all roles
CREATE POLICY "admins_manage_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_pulse_reports_user_id ON public.pulse_reports(user_id);
CREATE INDEX idx_pulse_reports_status ON public.pulse_reports(status);
CREATE INDEX idx_pulse_reports_created_at ON public.pulse_reports(created_at DESC);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);