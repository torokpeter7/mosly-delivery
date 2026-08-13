CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'mosly_employee', 'courier')) DEFAULT 'mosly_employee',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  house_number TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('order_received', 'out_for_delivery', 'courier_on_way', 'delivered')) DEFAULT 'order_received',
  created_by UUID REFERENCES public.profiles(id),
  courier_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.shipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_city ON public.shipments(city);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_history_shipment_id ON public.shipment_status_history(shipment_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_set_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.shipment_status_history(shipment_id, old_status, new_status, changed_by, created_at)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NOW());
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.shipment_status_history(shipment_id, old_status, new_status, changed_by, created_at)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shipments_handle_status_history
AFTER INSERT OR UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.handle_status_history();
