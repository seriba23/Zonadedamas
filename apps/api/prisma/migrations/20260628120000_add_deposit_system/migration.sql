-- Sistema de anticipo (depósito) para confirmar citas.

-- Config del negocio (tenant): activar anticipo, tipo (FIXED/PERCENT), valor e
-- instrucciones de transferencia (texto libre mostrado al cliente).
ALTER TABLE `tenants`
  ADD COLUMN `deposit_enabled`      BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN `deposit_type`         VARCHAR(10) NULL,
  ADD COLUMN `deposit_value`        DECIMAL(10,2) NULL,
  ADD COLUMN `deposit_instructions` TEXT NULL;

-- Snapshot del anticipo en la cita: si lo requería, monto solicitado, monto
-- acumulado recibido y si el negocio lo exoneró.
ALTER TABLE `appointments`
  ADD COLUMN `deposit_required` BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN `deposit_amount`   DECIMAL(10,2) NULL,
  ADD COLUMN `deposit_paid`     DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `deposit_waived`   BOOLEAN NOT NULL DEFAULT 0;

-- Marca de pago de anticipo (excluido del guard de doble pago).
ALTER TABLE `payments`
  ADD COLUMN `is_deposit` BOOLEAN NOT NULL DEFAULT 0;
