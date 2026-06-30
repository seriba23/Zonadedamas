-- Alergias y contacto de emergencia del cliente (también para walk-in, por eso
-- viven en clients y no solo en la cuenta de marketplace). Aditiva, nullable.
ALTER TABLE `clients`
  ADD COLUMN `allergies` TEXT NULL,
  ADD COLUMN `emergency_contact_name` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_last_name` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_phone` VARCHAR(191) NULL,
  ADD COLUMN `emergency_contact_relation` VARCHAR(50) NULL;
