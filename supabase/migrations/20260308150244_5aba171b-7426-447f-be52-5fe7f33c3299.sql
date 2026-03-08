
-- =============================================
-- FIX ALL RLS POLICIES: Convert RESTRICTIVE to PERMISSIVE
-- Fix broken logic on profiles, user_roles, audit_logs
-- =============================================

-- ============ AUDIT_LOGS ============
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ BACKUP_HISTORY ============
DROP POLICY IF EXISTS "Users can view own backups" ON public.backup_history;
DROP POLICY IF EXISTS "Users can insert own backups" ON public.backup_history;
DROP POLICY IF EXISTS "Users can update own backups" ON public.backup_history;
CREATE POLICY "Users can view own backups" ON public.backup_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own backups" ON public.backup_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own backups" ON public.backup_history FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ CASH_REGISTER ============
DROP POLICY IF EXISTS "Authenticated can view cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Authenticated can insert cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Authenticated can update cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Admins can delete cash register" ON public.cash_register;
CREATE POLICY "Authenticated can view cash register" ON public.cash_register FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cash register" ON public.cash_register FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cash register" ON public.cash_register FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete cash register" ON public.cash_register FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ CONTACTS ============
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can delete contacts" ON public.contacts;
CREATE POLICY "Authenticated can view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);

-- ============ DAILY_SUMMARIES ============
DROP POLICY IF EXISTS "Authenticated can view summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Authenticated can insert summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Authenticated can update summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Authenticated can delete summaries" ON public.daily_summaries;
CREATE POLICY "Authenticated can view summaries" ON public.daily_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert summaries" ON public.daily_summaries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update summaries" ON public.daily_summaries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete summaries" ON public.daily_summaries FOR DELETE TO authenticated USING (true);

-- ============ EXPENSE_CATEGORIES ============
DROP POLICY IF EXISTS "Authenticated can view expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Authenticated can manage expense categories" ON public.expense_categories;
CREATE POLICY "Authenticated can view expense categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage expense categories" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ EXPENSES ============
DROP POLICY IF EXISTS "Authenticated can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can delete expenses" ON public.expenses;
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);

-- ============ GOOGLE_DRIVE_TOKENS ============
DROP POLICY IF EXISTS "Users can view own tokens" ON public.google_drive_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.google_drive_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON public.google_drive_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON public.google_drive_tokens;
CREATE POLICY "Users can view own tokens" ON public.google_drive_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own tokens" ON public.google_drive_tokens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own tokens" ON public.google_drive_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own tokens" ON public.google_drive_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ PRODUCT_CATEGORIES ============
DROP POLICY IF EXISTS "Authenticated can view categories" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated can manage categories" ON public.product_categories;
CREATE POLICY "Authenticated can view categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage categories" ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "Authenticated can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can delete products" ON public.products;
CREATE POLICY "Authenticated can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- ============ PROFILES (fix broken AND logic) ============
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own or admin all profiles" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ PURCHASE_ITEMS ============
DROP POLICY IF EXISTS "Authenticated can view purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated can insert purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated can delete purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Authenticated can update purchase items" ON public.purchase_items;
CREATE POLICY "Authenticated can view purchase items" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase items" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchase items" ON public.purchase_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete purchase items" ON public.purchase_items FOR DELETE TO authenticated USING (true);

-- ============ PURCHASES ============
DROP POLICY IF EXISTS "Authenticated can view purchases" ON public.purchases;
DROP POLICY IF EXISTS "Authenticated can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Authenticated can update purchases" ON public.purchases;
DROP POLICY IF EXISTS "Authenticated can delete purchases" ON public.purchases;
CREATE POLICY "Authenticated can view purchases" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (true);

-- ============ SALE_ITEMS ============
DROP POLICY IF EXISTS "Authenticated can view sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated can delete sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated can update sale items" ON public.sale_items;
CREATE POLICY "Authenticated can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sale items" ON public.sale_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete sale items" ON public.sale_items FOR DELETE TO authenticated USING (true);

-- ============ SALE_TRANSACTIONS ============
DROP POLICY IF EXISTS "Authenticated can view sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated can update sales" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated can delete sales" ON public.sale_transactions;
CREATE POLICY "Authenticated can view sales" ON public.sale_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales" ON public.sale_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sales" ON public.sale_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete sales" ON public.sale_transactions FOR DELETE TO authenticated USING (true);

-- ============ TODOS (scope to user) ============
DROP POLICY IF EXISTS "Authenticated can view todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated can insert todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated can update todos" ON public.todos;
DROP POLICY IF EXISTS "Authenticated can delete todos" ON public.todos;
CREATE POLICY "Users can view own todos" ON public.todos FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can insert own todos" ON public.todos FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own todos" ON public.todos FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can delete own todos" ON public.todos FOR DELETE TO authenticated USING (created_by = auth.uid());

-- ============ USER_ROLES (fix broken AND logic) ============
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own or admin all roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
