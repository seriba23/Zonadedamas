-- Acceso al Punto de Venta por empleado.
-- El admin lo activa/desactiva desde la consola; cuando está activo, el
-- empleado ve el POS en su menú y RBAC le inyecta los permisos POS.
ALTER TABLE `employees` ADD COLUMN `pos_enabled` BOOLEAN NOT NULL DEFAULT false;
