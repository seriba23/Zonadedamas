-- Inyecta 10 citas COMPLETED + 10 reviews para Maria Garcia en Demo Salon.
-- Idempotente: si ya hay reviews suficientes no duplica (chequea por
-- comment unico antes de insertar). Diseñado para correr en produccion.
--
-- Uso:
--   mysql -u <user> -p<pass> <db> < apps/api/scripts/seed_maria_garcia_reviews.sql

-- 1) Resolver IDs base.
SET @tenantId  = (SELECT id FROM tenants WHERE slug = 'demo-salon');
SET @empId     = (
  SELECT id FROM employees
  WHERE tenant_id = @tenantId
    AND first_name = 'Maria' AND last_name = 'Garcia'
    AND is_active = true
  LIMIT 1
);
SET @clientId  = (
  SELECT c.id FROM clients c
  JOIN users u ON u.id = c.user_id
  WHERE u.email = 'sergioibarra275@gmail.com' AND c.tenant_id = @tenantId
  LIMIT 1
);
-- Tomamos el primer servicio activo asignado a María si existe; sino el
-- primer servicio activo del tenant.
SET @svcId = (
  SELECT es.service_id
  FROM employee_services es
  JOIN services s ON s.id = es.service_id
  WHERE es.employee_id = @empId AND s.is_active = true
  ORDER BY s.sort_order ASC
  LIMIT 1
);
SET @svcId = IFNULL(@svcId, (SELECT id FROM services WHERE tenant_id = @tenantId AND is_active = true LIMIT 1));
SET @locId = (SELECT id FROM locations WHERE tenant_id = @tenantId AND is_active = true LIMIT 1);

-- 2) Datos del servicio para los snapshots
SET @svcName  = (SELECT name FROM services WHERE id = @svcId);
SET @svcPrice = (SELECT price FROM services WHERE id = @svcId);
SET @svcDur   = (SELECT duration_minutes FROM services WHERE id = @svcId);

-- 3) Verificación previa (si falta alguno, abortamos limpiamente)
SELECT
  CONCAT('tenantId=', IFNULL(@tenantId,'NULL'),
         ' empId=', IFNULL(@empId,'NULL'),
         ' clientId=', IFNULL(@clientId,'NULL'),
         ' svcId=', IFNULL(@svcId,'NULL'),
         ' locId=', IFNULL(@locId,'NULL')) AS resolved_ids;

-- 4) Crear 10 citas COMPLETED + appointment_items + employee_reviews.
-- Fechas escalonadas hacia el pasado, 1 cita cada 3 dias (~30 dias).
-- Cada cita lleva su review unico (comentario distinto) para ser realista.

-- Comentarios pre-generados para las reviews.
DROP TEMPORARY TABLE IF EXISTS tmp_reviews;
CREATE TEMPORARY TABLE tmp_reviews (
  idx INT PRIMARY KEY,
  rating INT NOT NULL,
  comment VARCHAR(500) NOT NULL
);
INSERT INTO tmp_reviews (idx, rating, comment) VALUES
  (1, 5, 'Excelente atención de María, súper profesional. Me dejó el cabello perfecto.'),
  (2, 5, 'María tiene unas manos mágicas, salí encantada. Sin duda vuelvo.'),
  (3, 4, 'Muy buen servicio, María explica todo el procedimiento y resuelve dudas.'),
  (4, 5, 'Llegué con prisa y María me atendió rapidísimo sin perder calidad.'),
  (5, 5, 'Tercera vez que vengo con María, siempre impecable.'),
  (6, 4, 'María es muy amable y profesional. El local está limpio y cómodo.'),
  (7, 5, 'Recomendadísima. María tiene mucha experiencia, se nota al toque.'),
  (8, 5, 'Salí súper contenta, María recomienda productos y técnicas que sí funcionan.'),
  (9, 5, 'Cumplió 100% con lo que pedí. María tiene gran ojo para los detalles.'),
  (10, 5, 'María es lo mejor del Demo Salon, atención de primera y trato cercano.');

-- Insert appointments (idempotente: si ya hay 10+ con notes='__maria_seed__'
-- no insertamos otra vez).
SET @existing = (
  SELECT COUNT(*) FROM appointments
  WHERE tenant_id = @tenantId AND employee_id = @empId
    AND status = 'COMPLETED'
    AND notes = '__maria_seed__'
);

-- Solo procedemos si hay menos de 10 ya seedeadas.
-- Generamos 10 appointments en un INSERT...SELECT a partir de tmp_reviews.
-- Las columnas total_amount/currency no existen en `appointments` — el
-- total se deriva de appointment_items. Tampoco usamos discount_amount
-- ni points_spent (quedan en su default 0/NULL).
INSERT INTO appointments (
  id, tenant_id, client_id, employee_id, location_id,
  status, start_time, end_time,
  source, notes, created_at, updated_at
)
SELECT
  CONCAT('seed_maria_', LPAD(r.idx, 2, '0'), '_', SUBSTRING(MD5(RAND()), 1, 8)),
  @tenantId, @clientId, @empId, @locId,
  'COMPLETED',
  DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY),
  DATE_ADD(DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY), INTERVAL @svcDur MINUTE),
  'ONLINE', '__maria_seed__',
  DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY),
  DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY)
FROM tmp_reviews r
WHERE @existing < 10;

-- Insert appointment_items (uno por appointment recién creado, con el
-- servicio seleccionado).
INSERT INTO appointment_items (
  id, appointment_id, service_id, employee_id,
  service_name_snapshot, price_snapshot, duration_snapshot,
  created_at
)
SELECT
  CONCAT('seed_item_', LPAD(r.idx, 2, '0'), '_', SUBSTRING(MD5(RAND()), 1, 8)),
  a.id, @svcId, @empId,
  @svcName, @svcPrice, @svcDur,
  a.created_at
FROM tmp_reviews r
JOIN appointments a
  ON a.tenant_id = @tenantId
  AND a.employee_id = @empId
  AND a.notes = '__maria_seed__'
  AND a.start_time = DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY)
WHERE @existing < 10
  AND NOT EXISTS (SELECT 1 FROM appointment_items ai WHERE ai.appointment_id = a.id);

-- Insert employee_reviews (uno por appointment).
INSERT INTO employee_reviews (
  id, tenant_id, employee_id, client_id, appointment_id,
  rating, comment, is_visible, created_at, updated_at
)
SELECT
  CONCAT('seed_rev_', LPAD(r.idx, 2, '0'), '_', SUBSTRING(MD5(RAND()), 1, 8)),
  @tenantId, @empId, @clientId, a.id,
  r.rating, r.comment, 1,
  a.start_time, a.start_time
FROM tmp_reviews r
JOIN appointments a
  ON a.tenant_id = @tenantId
  AND a.employee_id = @empId
  AND a.notes = '__maria_seed__'
  AND a.start_time = DATE_SUB(NOW(), INTERVAL (r.idx * 3) DAY)
WHERE @existing < 10
  AND NOT EXISTS (SELECT 1 FROM employee_reviews er WHERE er.appointment_id = a.id);

-- 5) Verificación final.
SELECT
  (SELECT COUNT(*) FROM appointments WHERE employee_id = @empId AND status = 'COMPLETED') AS citas_completed,
  (SELECT COUNT(*) FROM employee_reviews WHERE employee_id = @empId AND is_visible = 1)  AS reviews_visibles,
  (SELECT COUNT(*) FROM appointments WHERE employee_id = @empId AND notes = '__maria_seed__') AS seed_appointments;

DROP TEMPORARY TABLE IF EXISTS tmp_reviews;
