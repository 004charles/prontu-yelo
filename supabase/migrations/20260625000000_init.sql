-- Initial schema for Tupuca Flow - Prontu ↔ Yelo reconciliation system

-- 1. Create custom tables
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prontu_payment_id TEXT UNIQUE NOT NULL,
    reference TEXT NOT NULL,
    customer_name TEXT,
    customer_contact TEXT,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'AOA' NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    raw JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yelo_order_id TEXT UNIQUE NOT NULL,
    reference TEXT,
    payment_ref TEXT, -- Links to payments.prontu_payment_id
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    raw JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    severity TEXT DEFAULT 'high' NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved', 'escalated')),
    assigned_to TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    at TIMESTAMPTZ DEFAULT now() NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL, -- e.g. 'incident.created', 'order.created_manually', 'customer.contacted'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'ops')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_prontu_payment_id ON public.payments(prontu_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);
CREATE INDEX IF NOT EXISTS idx_orders_yelo_order_id ON public.orders(yelo_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON public.orders(payment_ref);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders(reference);
CREATE INDEX IF NOT EXISTS idx_incidents_payment_id ON public.incidents(payment_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident_id ON public.incident_events(incident_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions and triggers

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.id = auth.uid() AND user_roles.role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to assign role to new users (first is admin, subsequent are ops)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  
  INSERT INTO public.user_roles (id, role)
  VALUES (
    new.id,
    CASE WHEN is_first THEN 'admin' ELSE 'ops' END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- 3. RLS Policies

-- User Roles Policies
CREATE POLICY "Users can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can edit user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- Payments Policies
CREATE POLICY "Ops and admins can view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

CREATE POLICY "Ops and admins can modify payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

-- Orders Policies
CREATE POLICY "Ops and admins can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

CREATE POLICY "Ops and admins can modify orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

-- Incidents Policies
CREATE POLICY "Ops and admins can view incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

CREATE POLICY "Ops and admins can modify incidents" ON public.incidents
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

-- Incident Events Policies
CREATE POLICY "Ops and admins can view incident events" ON public.incident_events
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

CREATE POLICY "Ops and admins can modify incident events" ON public.incident_events
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

-- Settings Policies
CREATE POLICY "Ops and admins can view settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('ops'));

CREATE POLICY "Only admins can modify settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- Enable realtime subscriptions for key tables
-- Note: Realtime in Supabase is enabled by adding tables to the supabase_realtime publication
alter publication supabase_realtime add table public.incidents;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.incident_events;
