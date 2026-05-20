-- Inyecta 12000 puntos de lealtad al usuario sergioibarra275@gmail.com en
-- el tenant 'demo-salon'. Idempotente: si el Client ya existe lo actualiza,
-- si no existe lo crea. Diseñado para correr en la BD de producción
-- (snake_case, MySQL/MariaDB).
--
-- Uso:
--   mysql -u <user> -p<pass> <db> < apps/api/scripts/inject_demo_points.sql

-- 1) Actualizar si el Client ya existe en demo-salon
UPDATE clients c
INNER JOIN users u   ON u.id = c.user_id
INNER JOIN tenants t ON t.id = c.tenant_id
SET c.loyalty_points = 12000
WHERE u.email = 'sergioibarra275@gmail.com'
  AND t.slug  = 'demo-salon';

-- 2) Insertar si NO existe (no afecta filas si el UPDATE ya lo creó)
INSERT INTO clients (id, tenant_id, user_id, first_name, last_name, email, phone, source, loyalty_points, created_at, updated_at)
SELECT
  CONCAT('manual_', REPLACE(UUID(),'-','')),
  t.id, u.id, u.first_name, COALESCE(u.last_name,''), u.email, u.phone, 'MARKETPLACE', 12000, NOW(), NOW()
FROM users u
JOIN tenants t ON t.slug = 'demo-salon'
WHERE u.email = 'sergioibarra275@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.user_id = u.id AND c.tenant_id = t.id);

-- 3) Verificación
SELECT c.id, c.loyalty_points, u.email, t.slug
FROM clients c
JOIN users u   ON u.id = c.user_id
JOIN tenants t ON t.id = c.tenant_id
WHERE u.email = 'sergioibarra275@gmail.com';
