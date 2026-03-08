
-- Cash Register table for daily cash drawer management
CREATE TABLE public.cash_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  cash_in NUMERIC NOT NULL DEFAULT 0,
  cash_out NUMERIC NOT NULL DEFAULT 0,
  expected_balance NUMERIC NOT NULL DEFAULT 0,
  actual_balance NUMERIC DEFAULT NULL,
  discrepancy NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date)
);

ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cash register" ON public.cash_register FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cash register" ON public.cash_register FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cash register" ON public.cash_register FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete cash register" ON public.cash_register FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Quick Notes / To-Do table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT DEFAULT 'normal',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view todos" ON public.todos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert todos" ON public.todos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update todos" ON public.todos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete todos" ON public.todos FOR DELETE TO authenticated USING (true);
