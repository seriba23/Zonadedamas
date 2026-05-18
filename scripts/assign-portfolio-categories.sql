-- ───────────────────────────────────────────────────────────────────
-- Asigna service_id a las fotos manuales del portfolio por empleado.
-- Correr DESPUES de aplicar la migration 20260517120000_portfolio_image_service.
--
-- Si tenés multi-tenant y querés filtrar a uno solo, descomentá y ajustá:
-- SET @tenant_id := (SELECT id FROM tenants WHERE slug = 'tu-slug');
-- Y agregá " AND e.tenant_id = @tenant_id " a cada WHERE.
-- ───────────────────────────────────────────────────────────────────

-- María → Corte y Peinado
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte y Peinado'
SET epi.service_id = s.id
WHERE e.first_name IN ('María', 'Maria');

-- Sofia → Manicure Clásica
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Manicure Clásica'
SET epi.service_id = s.id
WHERE e.first_name IN ('Sofía', 'Sofia');

-- James → Corte y Peinado
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte y Peinado'
SET epi.service_id = s.id
WHERE e.first_name = 'James';

-- Valentina → Corte y Peinado (igual que María)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte y Peinado'
SET epi.service_id = s.id
WHERE e.first_name = 'Valentina';

-- Andrea → Manicure Clásica
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Manicure Clásica'
SET epi.service_id = s.id
WHERE e.first_name = 'Andrea';

-- Camila → Corte y Peinado
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte y Peinado'
SET epi.service_id = s.id
WHERE e.first_name = 'Camila';

-- Diego → Corte y Peinado
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte y Peinado'
SET epi.service_id = s.id
WHERE e.first_name = 'Diego';

-- Lucia → Masaje Relajante (Spa)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Masaje Relajante'
SET epi.service_id = s.id
WHERE e.first_name IN ('Lucía', 'Lucia');

-- Javier → Tinte de Cabello (Color)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Tinte de Cabello'
SET epi.service_id = s.id
WHERE e.first_name = 'Javier';

-- Renata → Extensiones de Pestañas
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Extensiones de Pestañas'
SET epi.service_id = s.id
WHERE e.first_name = 'Renata';

-- ───────────────────────────────────────────────────────────────────
-- Verificación: ver cuántas fotos quedaron con servicio asignado por empleado.
-- ───────────────────────────────────────────────────────────────────
SELECT e.first_name, e.last_name, s.name AS service_name, COUNT(*) AS fotos
FROM employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
LEFT JOIN services s ON s.id = epi.service_id
GROUP BY e.id, s.id
ORDER BY e.first_name;
