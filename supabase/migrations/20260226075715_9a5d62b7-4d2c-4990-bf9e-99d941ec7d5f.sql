
-- Add missing triggers only if they don't exist
DO $$
BEGIN
  -- updated_at trigger for products
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
    CREATE TRIGGER update_products_updated_at
      BEFORE UPDATE ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;

  -- updated_at trigger for contacts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
    CREATE TRIGGER update_contacts_updated_at
      BEFORE UPDATE ON public.contacts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;

  -- profile creation trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
