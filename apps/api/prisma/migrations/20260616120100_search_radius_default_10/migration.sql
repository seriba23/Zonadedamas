-- AlterTable: baja el default de search_radius de 25 a 10 km.
-- Los registros existentes con search_radius=25 NO se tocan; solo nuevos
-- registros entran con 10. Si quieres migrar usuarios viejos manualmente:
--   UPDATE users SET search_radius = 10 WHERE search_radius = 25;
ALTER TABLE `users` MODIFY COLUMN `search_radius` INT NOT NULL DEFAULT 10;
