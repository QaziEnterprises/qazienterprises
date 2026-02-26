
-- Recreate the invoice sequence if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'invoice_seq') THEN
    CREATE SEQUENCE public.invoice_seq START WITH 1;
  END IF;
END $$;

-- Sync sequence to current max invoice number
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '[^0-9]', '', 'g'), '')::INTEGER), 0)
  INTO max_num
  FROM public.sale_transactions
  WHERE invoice_no IS NOT NULL;
  
  IF max_num > 0 THEN
    PERFORM setval('public.invoice_seq', max_num);
  END IF;
END $$;

-- Recreate trigger for auto-generating invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.invoice_no := 'INV-' || LPAD(NEXTVAL('invoice_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_invoice_no ON public.sale_transactions;
CREATE TRIGGER set_invoice_no
  BEFORE INSERT ON public.sale_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invoice_no();

-- Recreate trigger for updated_at on products
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Recreate handle_new_user trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add customer_type column to sale_transactions for walk-in/regular/wholesale tracking
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'walk-in';
