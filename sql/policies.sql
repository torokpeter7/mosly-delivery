ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.is_active = true
      AND pr.role = ANY(required_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_role(text[]) TO authenticated;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR public.user_has_role(ARRAY['admin'])
);

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id OR public.user_has_role(ARRAY['admin'])
)
WITH CHECK (
  auth.uid() = id OR public.user_has_role(ARRAY['admin'])
);

CREATE POLICY "shipments_select_admin_employee_or_courier"
ON public.shipments
FOR SELECT
USING (
  public.user_has_role(ARRAY['admin', 'mosly_employee', 'courier'])
);

CREATE POLICY "shipments_insert_admin_or_employee"
ON public.shipments
FOR INSERT
WITH CHECK (
  public.user_has_role(ARRAY['admin', 'mosly_employee'])
);

CREATE POLICY "shipments_update_admin_or_employee_or_courier"
ON public.shipments
FOR UPDATE
USING (
  public.user_has_role(ARRAY['admin', 'mosly_employee', 'courier'])
)
WITH CHECK (
  public.user_has_role(ARRAY['admin', 'mosly_employee', 'courier'])
);

CREATE POLICY "shipment_status_history_select_admin_or_employee_or_courier"
ON public.shipment_status_history
FOR SELECT
USING (
  public.user_has_role(ARRAY['admin', 'mosly_employee', 'courier'])
);

CREATE POLICY "shipment_status_history_insert_admin_or_employee_or_courier"
ON public.shipment_status_history
FOR INSERT
WITH CHECK (
  public.user_has_role(ARRAY['admin', 'mosly_employee', 'courier'])
);

-- A nyilvános csomagkövetéshez nem adunk közvetlen SELECT jogosultságot a shipments táblára.
-- A publikus adathozzáférés kizárólag a public.get_public_tracking_info() RPC függvényen keresztül történik.
-- Ez megakadályozza, hogy a személyes adatok nyilvánosan lekérdezhetők legyenek.
