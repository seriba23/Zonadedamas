-- ============================================================
-- Diferenciacion freelancer (independiente, plan Basico $300 MXN)
-- vs empresa (con equipo, plan Plus $500 MXN).
-- Lo seteamos en el Tenant para no acoplarlo a Subscription
-- (que puede cambiar de estado/expirar/cambiar de plan).
-- ============================================================

-- 1. Agregar columna tenant_type con default BUSINESS (cubre tenants existentes).
ALTER TABLE `tenants`
  ADD COLUMN `tenant_type` ENUM('FREELANCER', 'BUSINESS') NOT NULL DEFAULT 'BUSINESS';

-- 2. Backfill: tenants que actualmente cumplen el perfil "freelancer"
--    (Basico + <=1 empleado facturado + monto <= 300) se marcan FREELANCER.
UPDATE `tenants` t
INNER JOIN `subscriptions` s ON s.tenant_id = t.id
SET t.tenant_type = 'FREELANCER'
WHERE s.plan = 'BASICO'
  AND s.billed_employee_count <= 1
  AND s.monthly_amount_usd <= 300;
