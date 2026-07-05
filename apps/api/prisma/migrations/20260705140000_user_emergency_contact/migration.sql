-- Contacto de emergencia que el cliente mantiene en su propia cuenta de la
-- plataforma. Se muestra en la consola del negocio cuando la ficha está validada.
-- Aditiva, nullable.
ALTER TABLE `users`
  ADD COLUMN `emergency_contact_name` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_last_name` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_phone` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_relation` VARCHAR(50) NULL;
