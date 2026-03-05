
-- Create daily_summaries table for persistent daily records
CREATE TABLE public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_sales numeric DEFAULT 0,
  total_purchases numeric DEFAULT 0,
  total_expenses numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  sales_count integer DEFAULT 0,
  purchases_count integer DEFAULT 0,
  expenses_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view summaries" ON public.daily_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert summaries" ON public.daily_summaries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update summaries" ON public.daily_summaries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete summaries" ON public.daily_summaries FOR DELETE TO authenticated USING (true);

-- Expand permissions: Allow all authenticated users to write (not just admins)

-- contacts
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts " ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert contacts " ON public.contacts;
DROP POLICY IF EXISTS "Admins can update contacts " ON public.contacts;
CREATE POLICY "Authenticated can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);

-- products
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products " ON public.products;
DROP POLICY IF EXISTS "Admins can update products " ON public.products;
DROP POLICY IF EXISTS "Admins can delete products " ON public.products;
CREATE POLICY "Authenticated can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- product_categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins can manage categories " ON public.product_categories;
CREATE POLICY "Authenticated can manage categories" ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expenses
DROP POLICY IF EXISTS "Admins can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can insert expenses " ON public.expenses;
DROP POLICY IF EXISTS "Admins can update expenses " ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses " ON public.expenses;
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);

-- expense_categories
DROP POLICY IF EXISTS "Admins can manage expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Admins can manage expense categories " ON public.expense_categories;
CREATE POLICY "Authenticated can manage expense categories" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sale_transactions
DROP POLICY IF EXISTS "Admins can insert sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Admins can update sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Admins can delete sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Admins can insert sales " ON public.sale_transactions;
DROP POLICY IF EXISTS "Admins can update sales " ON public.sale_transactions;
DROP POLICY IF EXISTS "Admins can delete sales " ON public.sale_transactions;
CREATE POLICY "Authenticated can insert sales" ON public.sale_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sales" ON public.sale_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete sales" ON public.sale_transactions FOR DELETE TO authenticated USING (true);

-- sale_items
DROP POLICY IF EXISTS "Admins can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Admins can delete sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Admins can insert sale items " ON public.sale_items;
DROP POLICY IF EXISTS "Admins can delete sale items " ON public.sale_items;
CREATE POLICY "Authenticated can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete sale items" ON public.sale_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can update sale items" ON public.sale_items FOR UPDATE TO authenticated USING (true);

-- purchases
DROP POLICY IF EXISTS "Admins can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can update purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can delete purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can insert purchases " ON public.purchases;
DROP POLICY IF EXISTS "Admins can update purchases " ON public.purchases;
DROP POLICY IF EXISTS "Admins can delete purchases " ON public.purchases;
CREATE POLICY "Authenticated can insert purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (true);

-- purchase_items
DROP POLICY IF EXISTS "Admins can insert purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admins can delete purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admins can insert purchase items " ON public.purchase_items;
DROP POLICY IF EXISTS "Admins can delete purchase items " ON public.purchase_items;
CREATE POLICY "Authenticated can insert purchase items" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete purchase items" ON public.purchase_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can update purchase items" ON public.purchase_items FOR UPDATE TO authenticated USING (true);
