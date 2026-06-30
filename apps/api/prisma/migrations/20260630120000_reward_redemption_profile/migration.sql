-- Cupones por perfil: cada RewardRedemption pertenece al perfil (estilo Netflix)
-- que lo canjeó, para que no se compartan entre el tutor y sus hijos.

-- 1) Columna nullable (las redemptions antiguas se rellenan abajo).
ALTER TABLE `reward_redemptions` ADD COLUMN `profile_id` VARCHAR(191) NULL;

-- 2) Índice + clave foránea hacia profiles (SetNull si se borra el perfil).
CREATE INDEX `reward_redemptions_profile_id_idx` ON `reward_redemptions`(`profile_id`);
ALTER TABLE `reward_redemptions`
  ADD CONSTRAINT `reward_redemptions_profile_id_fkey`
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Backfill: hereda el perfil del client al que ya está atada la redemption.
UPDATE `reward_redemptions` `rr`
JOIN `clients` `c` ON `rr`.`client_id` = `c`.`id`
SET `rr`.`profile_id` = `c`.`profile_id`
WHERE `rr`.`profile_id` IS NULL AND `c`.`profile_id` IS NOT NULL;
