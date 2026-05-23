-- Agrega un código corto único (code) a product_reservations. Lo usamos
-- como referencia humana en WhatsApp y comunicaciones con el negocio.

ALTER TABLE product_reservations
  ADD COLUMN IF NOT EXISTS code VARCHAR(20) NULL UNIQUE AFTER payment_proof_url;

-- Pobla reservas existentes con un código basado en el id (6 chars hex
-- en mayúsculas). Suficientemente único para los registros actuales y
-- mantiene determinismo para no re-generar en cada corrida.
UPDATE product_reservations
SET code = UPPER(SUBSTRING(REPLACE(id, '-', ''), 1, 6))
WHERE code IS NULL;

-- Verificación
SELECT id, code, customer_name, status, created_at
FROM product_reservations
ORDER BY created_at DESC
LIMIT 10;
