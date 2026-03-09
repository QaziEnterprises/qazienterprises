-- Enable required extensions for scheduled jobs + HTTP calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule Google Drive backups daily at 00:00 UTC
DO $$
DECLARE
  jid int;
BEGIN
  SELECT jobid INTO jid
  FROM cron.job
  WHERE jobname = 'daily_google_drive_backup';

  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;

  PERFORM cron.schedule(
    'daily_google_drive_backup',
    '0 0 * * *',
    'SELECT net.http_post(url:=''https://wcnomdrzqbnaaleaqfsh.supabase.co/functions/v1/google-drive-backup'', headers:=''{"Content-Type":"application/json"}''::jsonb, body:=''{"scheduled":true}''::jsonb);'
  );
END $$;