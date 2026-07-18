-- Bloqueo de clientes por el negocio: no pueden agendar más citas. Aditivo.
ALTER TABLE `clients`
  ADD COLUMN `is_blocked` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `blocked_reason` TEXT NULL,
  ADD COLUMN `blocked_at` DATETIME(3) NULL;
