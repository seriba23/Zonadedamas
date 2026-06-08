-- Marca que el empleado finalizó el servicio pero delegó el cobro al POS.
-- La cita queda IN_PROGRESS hasta que el cajero registre el pago.
ALTER TABLE `appointments`
  ADD COLUMN `pending_pos_payment` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `appointments_pending_pos_payment_idx`
  ON `appointments`(`pending_pos_payment`);
