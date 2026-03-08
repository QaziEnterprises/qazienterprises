
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_identifier_time ON public.login_attempts (identifier, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_login_attempts
  AFTER INSERT ON public.login_attempts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_login_attempts();

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
