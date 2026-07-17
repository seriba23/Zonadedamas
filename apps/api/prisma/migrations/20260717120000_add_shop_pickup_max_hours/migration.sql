-- Tiempo máximo (en horas) para recoger un producto apartado antes de que
-- expire el apartado. A nivel tienda (Tenant). Aditiva, nullable (null = sin
-- límite), para no requerir reset ni afectar datos existentes.
ALTER TABLE `tenants`
  ADD COLUMN `shop_pickup_max_hours` INT NULL;
