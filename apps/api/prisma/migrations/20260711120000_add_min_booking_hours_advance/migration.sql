-- Antelación mínima (en horas) para que un CLIENTE reserve una cita.
-- 0 = sin mínimo. Aplica solo a reservas de cliente (marketplace/portal/público).
ALTER TABLE `tenants` ADD COLUMN `min_booking_hours_advance` INT NOT NULL DEFAULT 0;
