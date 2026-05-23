-- Agrega captura del comprobante de pago al modelo de citas.
-- El cliente puede subirla desde el portal cuando paga por transferencia.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR(500) NULL AFTER points_spent;
