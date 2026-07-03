-- Descripción por defecto del catálogo de servicios (la gestiona el superadmin).
-- Se precarga al crear un servicio en un negocio; cada negocio edita la suya sin
-- afectar la global. Aditiva, nullable.
ALTER TABLE `service_catalog`
  ADD COLUMN `description` TEXT NULL;
