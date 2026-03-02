
-- Drop and recreate triggers safely
DROP TRIGGER IF EXISTS set_invoice_no ON public.sale_transactions;
DROP TRIGGER IF EXISTS set_updated_at_products ON public.products;
DROP TRIGGER IF EXISTS set_updated_at_contacts ON public.contacts;

CREATE TRIGGER set_invoice_no
  BEFORE INSERT ON public.sale_transactions
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_no();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_contacts
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
