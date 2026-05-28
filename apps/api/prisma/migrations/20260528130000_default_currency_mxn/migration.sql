-- ============================================================
-- Cambio de moneda default a MXN.
-- Hoy el SaaS opera en Mexico (pesos mexicanos). El default USD era
-- legado de la primera version multi-pais. Esto evita que un usuario
-- nuevo vea "$ USD" en su cuenta.
--
-- Tambien hace backfill: tenants/services/payments existentes que
-- quedaron con 'USD' se cambian a 'MXN'. El SaaS local nunca cobro en
-- dolares reales, asi que el cambio no afecta montos.
-- ============================================================

-- 1. Cambiar defaults de las columnas
ALTER TABLE `tenants` ALTER COLUMN `currency` SET DEFAULT 'MXN';
ALTER TABLE `services` ALTER COLUMN `currency` SET DEFAULT 'MXN';
ALTER TABLE `payments` ALTER COLUMN `currency` SET DEFAULT 'MXN';

-- 2. Backfill: filas que todavia tienen 'USD'
UPDATE `tenants` SET `currency` = 'MXN' WHERE `currency` = 'USD';
UPDATE `services` SET `currency` = 'MXN' WHERE `currency` = 'USD';
UPDATE `payments` SET `currency` = 'MXN' WHERE `currency` = 'USD';
