-- Enable RLS on pulse_reports if not already enabled
ALTER TABLE public.pulse_reports ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pulse_uploads if not already enabled  
ALTER TABLE public.pulse_uploads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on pulse_uploads
DROP POLICY IF EXISTS "allow anon insert" ON public.pulse_uploads;
DROP POLICY IF EXISTS "auth users can use uploads" ON public.pulse_uploads;

-- Add RLS policies for pulse_uploads
CREATE POLICY "anon_can_insert_uploads"
ON public.pulse_uploads
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "users_view_own_uploads"
ON public.pulse_uploads
FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT user_id FROM pulse_reports WHERE pulse_reports.upload_id = pulse_uploads.id LIMIT 1));

CREATE POLICY "admins_full_access_uploads"
ON public.pulse_uploads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));