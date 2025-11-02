-- Drop anonymous insert policies that allow unauthenticated uploads
DROP POLICY IF EXISTS "anon_can_insert_reports" ON pulse_reports;
DROP POLICY IF EXISTS "anon_can_insert_uploads" ON pulse_uploads;