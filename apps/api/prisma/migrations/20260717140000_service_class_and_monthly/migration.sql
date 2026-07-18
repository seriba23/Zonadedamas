-- Servicio como CLASE (con su tipo) y opción de MENSUALIDAD (solo clases).
-- Aditivo: columnas nullable / con default; FK con ON DELETE SET NULL para que
-- borrar un tipo de clase no borre el servicio (solo lo desetiqueta).
ALTER TABLE `services`
  ADD COLUMN `class_type_id` VARCHAR(191) NULL,
  ADD COLUMN `is_monthly` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `services`
  ADD CONSTRAINT `services_class_type_id_fkey`
  FOREIGN KEY (`class_type_id`) REFERENCES `class_types`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
