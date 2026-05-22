-- Agrega la columna payment_proof_url a product_reservations.
-- Es la captura del comprobante de transferencia SPEI que el cliente sube
-- al hacer el apartado; el admin la verifica para confirmar la reserva.

ALTER TABLE product_reservations
  ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR(500) NULL AFTER user_id;
