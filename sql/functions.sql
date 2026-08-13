CREATE OR REPLACE FUNCTION public.get_public_tracking_info(p_tracking_number TEXT)
RETURNS TABLE (
  tracking_number TEXT,
  status TEXT,
  status_label TEXT,
  updated_at TIMESTAMPTZ,
  status_history TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT s.tracking_number,
           s.status,
           CASE s.status
             WHEN 'order_received' THEN 'Rendelés felvéve'
             WHEN 'out_for_delivery' THEN 'Kiszállítás alatt'
             WHEN 'courier_on_way' THEN 'Úton hozzád'
             WHEN 'delivered' THEN 'Kiszállítva'
             ELSE s.status
           END AS status_label,
           s.updated_at,
           COALESCE(
             ARRAY(
               SELECT CASE h.new_status
                 WHEN 'order_received' THEN 'Rendelés felvéve'
                 WHEN 'out_for_delivery' THEN 'Kiszállítás alatt'
                 WHEN 'courier_on_way' THEN 'Önhöz tart a futár'
                 WHEN 'delivered' THEN 'Kiszállítva'
                 ELSE h.new_status
               END || ' — ' || to_char(h.created_at, 'YYYY.MM.DD HH24:MI')
               FROM public.shipment_status_history h
               WHERE h.shipment_id = s.id
               ORDER BY h.created_at ASC
             ),
             ARRAY[]::TEXT[]
           ) AS history
    FROM public.shipments s
    WHERE s.tracking_number = p_tracking_number
  )
  SELECT l.tracking_number,
         l.status,
         l.status_label,
         l.updated_at,
         l.history
  FROM latest l;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_tracking_info(TEXT) TO authenticated;
