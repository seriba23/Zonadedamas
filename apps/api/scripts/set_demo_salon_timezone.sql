-- Pobla Location.timezone para las sucursales de Demo Salon.
-- Cada sucursal puede tener su propia TZ según su localización física.
-- Por defecto las de Demo Salon operan en CDMX. Si tu tenant tiene
-- sucursales en otras zonas, ajusta los valores.

UPDATE locations
SET timezone = 'America/Mexico_City'
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo-salon')
  AND (timezone IS NULL OR timezone = '' OR timezone = 'UTC');

-- Verificación
SELECT name, timezone, address FROM locations
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo-salon');
