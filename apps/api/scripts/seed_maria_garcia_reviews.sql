-- Inyecta 10 citas COMPLETED + 10 reviews para Maria Garcia en Demo Salon.
-- Idempotente: si ya hay 10+ con notes='__maria_seed__' no inserta otra
-- vez. Usa una tabla temporal con UUIDs pre-generados para que appointments,
-- appointment_items y employee_reviews se vinculen sin depender de joins
-- por timestamp (que fallaban por precisión de milisegundos).
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
SET @svcId = (
  SELECT es.service_id FROM employee_services es
  JOIN services s ON s.id = es.service_id
  WHERE es.employee_id = @empId AND s.is_active = true
  ORDER BY s.sort_order ASC LIMIT 1
);
SET @svcId  = IFNULL(@svcId, (SELECT id FROM services WHERE tenant_id = @tenantId AND is_active = true LIMIT 1));
SET @locId  = (SELECT id FROM locations WHERE tenant_id = @tenantId AND is_active = true LIMIT 1);
SET @svcName  = (SELECT name FROM services WHERE id = @svcId);
SET @svcPrice = (SELECT price FROM services WHERE id = @svcId);
SET @svcDur   = (SELECT duration_minutes FROM services WHERE id = @svcId);

SELECT
  CONCAT('tenantId=', IFNULL(@tenantId,'NULL'),
         ' empId=', IFNULL(@empId,'NULL'),
         ' clientId=', IFNULL(@clientId,'NULL'),
         ' svcId=', IFNULL(@svcId,'NULL'),
         ' locId=', IFNULL(@locId,'NULL')) AS resolved_ids;

-- 2) Tabla temporal con UUIDs pre-generados para cada fila.
-- Asi appointments, items y reviews comparten ids sin joins frágiles.
DROP TEMPORARY TABLE IF EXISTS tmp_seed;
CREATE TEMPORARY TABLE tmp_seed (
  idx INT PRIMARY KEY,
  appt_id VARCHAR(191) NOT NULL,
  item_id VARCHAR(191) NOT NULL,
  review_id VARCHAR(191) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  rating INT NOT NULL,
  comment VARCHAR(500) NOT NULL
);

INSERT INTO tmp_seed (idx, appt_id, item_id, review_id, start_time, end_time, rating, comment) VALUES
  (1,  CONCAT('seed_appt_01_', REPLACE(UUID(),'-','')), CONCAT('seed_item_01_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_01_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 3 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY),  INTERVAL @svcDur MINUTE), 5, 'Excelente atención de María, súper profesional. Me dejó el cabello perfecto.'),
  (2,  CONCAT('seed_appt_02_', REPLACE(UUID(),'-','')), CONCAT('seed_item_02_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_02_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 6 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY),  INTERVAL @svcDur MINUTE), 5, 'María tiene unas manos mágicas, salí encantada. Sin duda vuelvo.'),
  (3,  CONCAT('seed_appt_03_', REPLACE(UUID(),'-','')), CONCAT('seed_item_03_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_03_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 9 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY),  INTERVAL @svcDur MINUTE), 4, 'Muy buen servicio, María explica todo el procedimiento y resuelve dudas.'),
  (4,  CONCAT('seed_appt_04_', REPLACE(UUID(),'-','')), CONCAT('seed_item_04_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_04_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 12 DAY), INTERVAL @svcDur MINUTE), 5, 'Llegué con prisa y María me atendió rapidísimo sin perder calidad.'),
  (5,  CONCAT('seed_appt_05_', REPLACE(UUID(),'-','')), CONCAT('seed_item_05_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_05_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 15 DAY), INTERVAL @svcDur MINUTE), 5, 'Tercera vez que vengo con María, siempre impecable.'),
  (6,  CONCAT('seed_appt_06_', REPLACE(UUID(),'-','')), CONCAT('seed_item_06_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_06_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 18 DAY), INTERVAL @svcDur MINUTE), 4, 'María es muy amable y profesional. El local está limpio y cómodo.'),
  (7,  CONCAT('seed_appt_07_', REPLACE(UUID(),'-','')), CONCAT('seed_item_07_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_07_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 21 DAY), INTERVAL @svcDur MINUTE), 5, 'Recomendadísima. María tiene mucha experiencia, se nota al toque.'),
  (8,  CONCAT('seed_appt_08_', REPLACE(UUID(),'-','')), CONCAT('seed_item_08_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_08_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 24 DAY), INTERVAL @svcDur MINUTE), 5, 'Salí súper contenta, María recomienda productos y técnicas que sí funcionan.'),
  (9,  CONCAT('seed_appt_09_', REPLACE(UUID(),'-','')), CONCAT('seed_item_09_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_09_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 27 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 27 DAY), INTERVAL @svcDur MINUTE), 5, 'Cumplió 100% con lo que pedí. María tiene gran ojo para los detalles.'),
  (10, CONCAT('seed_appt_10_', REPLACE(UUID(),'-','')), CONCAT('seed_item_10_', REPLACE(UUID(),'-','')), CONCAT('seed_rev_10_', REPLACE(UUID(),'-','')), DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 30 DAY), INTERVAL @svcDur MINUTE), 5, 'María es lo mejor del Demo Salon, atención de primera y trato cercano.');

-- 3) Limpieza de seed previo INCOMPLETO: si hay appointments con la marca
-- __maria_seed__ pero SIN items asociados, las borramos para reseedear
-- limpio. Las completas (con items + review) no se tocan.
DELETE FROM appointments
WHERE tenant_id = @tenantId
  AND employee_id = @empId
  AND notes = '__maria_seed__'
  AND id NOT IN (SELECT DISTINCT appointment_id FROM appointment_items);

-- Solo seedea si hay menos de 10 con la marca tras la limpieza.
SET @existing = (
  SELECT COUNT(*) FROM appointments
  WHERE tenant_id = @tenantId AND employee_id = @empId AND notes = '__maria_seed__'
);

-- 4) Insert appointments
INSERT INTO appointments (
  id, tenant_id, client_id, employee_id, location_id,
  status, start_time, end_time,
  source, notes, created_at, updated_at
)
SELECT
  t.appt_id, @tenantId, @clientId, @empId, @locId,
  'COMPLETED', t.start_time, t.end_time,
  'ONLINE', '__maria_seed__', t.start_time, t.start_time
FROM tmp_seed t
WHERE @existing < 10;

-- 5) Insert appointment_items vinculados por appt_id (NO por timestamp)
INSERT INTO appointment_items (
  id, appointment_id, service_id, employee_id,
  service_name_snapshot, price_snapshot, duration_snapshot,
  start_time, end_time
)
SELECT
  t.item_id, t.appt_id, @svcId, @empId,
  @svcName, @svcPrice, @svcDur,
  t.start_time, t.end_time
FROM tmp_seed t
JOIN appointments a ON a.id = t.appt_id
WHERE @existing < 10
  AND NOT EXISTS (SELECT 1 FROM appointment_items ai WHERE ai.appointment_id = t.appt_id);

-- 6) Insert employee_reviews vinculados por appt_id
INSERT INTO employee_reviews (
  id, tenant_id, employee_id, client_id, appointment_id,
  rating, comment, is_visible, created_at, updated_at
)
SELECT
  t.review_id, @tenantId, @empId, @clientId, t.appt_id,
  t.rating, t.comment, 1,
  t.start_time, t.start_time
FROM tmp_seed t
JOIN appointments a ON a.id = t.appt_id
WHERE @existing < 10
  AND NOT EXISTS (SELECT 1 FROM employee_reviews er WHERE er.appointment_id = t.appt_id);

-- 7) Verificacion final
SELECT
  (SELECT COUNT(*) FROM appointments       WHERE employee_id = @empId AND status = 'COMPLETED') AS citas_completed,
  (SELECT COUNT(*) FROM employee_reviews   WHERE employee_id = @empId AND is_visible = 1)        AS reviews_visibles,
  (SELECT COUNT(*) FROM appointments       WHERE employee_id = @empId AND notes = '__maria_seed__') AS seed_appointments,
  (SELECT COUNT(*) FROM appointment_items  WHERE employee_id = @empId AND appointment_id IN (
    SELECT id FROM appointments WHERE employee_id = @empId AND notes = '__maria_seed__'
  )) AS seed_items;

DROP TEMPORARY TABLE IF EXISTS tmp_seed;
