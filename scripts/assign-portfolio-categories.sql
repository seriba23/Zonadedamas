-- ───────────────────────────────────────────────────────────────────
-- Asigna service_id a las fotos manuales del portfolio por empleado.
-- Correr DESPUES de aplicar la migration 20260517120000_portfolio_image_service.
--
-- Servicios reales de la DB (verificado en VPS):
--   Estilista:   "Corte de caballero", "Corte de dama", "Peinado casual"
--   Manicurista: "Manicure", "Manicure Clásico", "Pedicure spa"
--   Colorista:   "Tinte completo", "Tinte fantasía"
--   Masajista:   "Masaje relajante", "Masaje reductivo"
--   Esteticista: "Limpieza facial profunda", "Depilación facial", "Depilación corporal con cera"
-- ───────────────────────────────────────────────────────────────────

-- María → Corte de dama
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte de dama'
SET epi.service_id = s.id
WHERE e.first_name IN ('María', 'Maria');

-- Sofia → Manicure
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Manicure'
SET epi.service_id = s.id
WHERE e.first_name IN ('Sofía', 'Sofia');

-- James → Corte de caballero
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte de caballero'
SET epi.service_id = s.id
WHERE e.first_name = 'James';

-- Valentina → Corte de dama (igual que María)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte de dama'
SET epi.service_id = s.id
WHERE e.first_name = 'Valentina';

-- Andrea → Manicure
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Manicure'
SET epi.service_id = s.id
WHERE e.first_name = 'Andrea';

-- Camila → Corte de dama
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte de dama'
SET epi.service_id = s.id
WHERE e.first_name = 'Camila';

-- Diego → Corte de caballero
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Corte de caballero'
SET epi.service_id = s.id
WHERE e.first_name = 'Diego';

-- Lucía → Masaje relajante (Spa)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Masaje relajante'
SET epi.service_id = s.id
WHERE e.first_name IN ('Lucía', 'Lucia');

-- Javier → Tinte completo (Color)
UPDATE employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Tinte completo'
SET epi.service_id = s.id
WHERE e.first_name = 'Javier';

-- Renata → Pestañas (no existe servicio. pendiente de definir)
-- Cuando exista, ejecutar:
-- UPDATE employee_portfolio_images epi
-- JOIN employees e ON e.id = epi.employee_id
-- JOIN services  s ON s.tenant_id = e.tenant_id AND s.name = 'Pestañas'
-- SET epi.service_id = s.id
-- WHERE e.first_name = 'Renata';

-- ───────────────────────────────────────────────────────────────────
-- Verificación
-- ───────────────────────────────────────────────────────────────────
SELECT e.first_name, e.last_name, s.name AS service_name, COUNT(*) AS fotos
FROM employee_portfolio_images epi
JOIN employees e ON e.id = epi.employee_id
LEFT JOIN services s ON s.id = epi.service_id
GROUP BY e.id, s.id
ORDER BY e.first_name;
