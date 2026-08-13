DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@moslydelivery.hu') THEN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Mosly Admin'), 'admin', TRUE
    FROM auth.users
    WHERE email = 'admin@moslydelivery.hu'
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO public.shipments (
  tracking_number,
  customer_name,
  customer_email,
  customer_phone,
  postal_code,
  city,
  street,
  house_number,
  notes,
  status,
  created_by,
  courier_id,
  created_at,
  updated_at
)
VALUES (
  'MSL-8F42K9',
  'Kiss Péter',
  'peter.kiss@example.com',
  '+36 20 123 4567',
  '6500',
  'Baja',
  'Kossuth Lajos utca',
  '12',
  'Zárt ajtós kézbesítés.',
  'order_received',
  NULL,
  NULL,
  NOW(),
  NOW()
), (
  'MSL-4Q74FN',
  'Nagy Anikó',
  'anikonagy@example.com',
  '+36 30 765 4321',
  '6500',
  'Baja',
  'Fő utca',
  '7',
  'Munkaszüneti napra is kézbesíteni kell.',
  'out_for_delivery',
  NULL,
  NULL,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '12 hours'
)
ON CONFLICT (tracking_number) DO NOTHING;

INSERT INTO public.shipment_status_history (shipment_id, old_status, new_status, changed_by, created_at)
SELECT id, NULL, 'order_received', NULL, NOW()
FROM public.shipments WHERE tracking_number = 'MSL-8F42K9'
ON CONFLICT DO NOTHING;

INSERT INTO public.shipment_status_history (shipment_id, old_status, new_status, changed_by, created_at)
SELECT id, 'order_received', 'out_for_delivery', NULL, NOW() - INTERVAL '12 hours'
FROM public.shipments WHERE tracking_number = 'MSL-4Q74FN'
ON CONFLICT DO NOTHING;
