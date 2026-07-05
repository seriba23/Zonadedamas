-- Token de "reclamo" de cuenta: el negocio invita por WhatsApp a un cliente
-- walk-in a crear/vincular su cuenta real de la plataforma. Ata el enlace a la
-- ficha para prellenar y unificar. Aditiva, nullable, único.
ALTER TABLE `clients`
  ADD COLUMN `claim_token` VARCHAR(191) NULL,
  ADD COLUMN `claim_token_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `clients_claim_token_key` ON `clients`(`claim_token`);
