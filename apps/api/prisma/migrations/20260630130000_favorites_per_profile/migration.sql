-- Favoritos por perfil (negocios y profesionales): cada perfil (estilo Netflix)
-- tiene su propia lista. La columna profile_id es nullable; los favoritos
-- antiguos se reasignan al perfil titular (SELF/default) de cada usuario.

-- ─── NEGOCIOS: marketplace_favorites ───────────────────────────────────────
ALTER TABLE `marketplace_favorites` ADD COLUMN `profile_id` VARCHAR(191) NULL;

-- Backfill: el favorito hereda el perfil titular del usuario (default o SELF).
UPDATE `marketplace_favorites` `mf`
SET `mf`.`profile_id` = (
  SELECT `p`.`id` FROM `profiles` `p`
  WHERE `p`.`user_id` = `mf`.`user_id`
  ORDER BY `p`.`is_default` DESC, (`p`.`relationship` = 'SELF') DESC, `p`.`created_at` ASC
  LIMIT 1
)
WHERE `mf`.`profile_id` IS NULL;

CREATE INDEX `marketplace_favorites_profile_id_idx` ON `marketplace_favorites`(`profile_id`);
ALTER TABLE `marketplace_favorites`
  ADD CONSTRAINT `marketplace_favorites_profile_id_fkey`
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Swap del unique: (user, tenant) -> (user, profile, tenant).
DROP INDEX `marketplace_favorites_user_id_tenant_id_key` ON `marketplace_favorites`;
CREATE UNIQUE INDEX `marketplace_favorites_user_id_profile_id_tenant_id_key`
  ON `marketplace_favorites`(`user_id`, `profile_id`, `tenant_id`);

-- ─── PROFESIONALES: marketplace_professional_favorites ──────────────────────
ALTER TABLE `marketplace_professional_favorites` ADD COLUMN `profile_id` VARCHAR(191) NULL;

UPDATE `marketplace_professional_favorites` `mpf`
SET `mpf`.`profile_id` = (
  SELECT `p`.`id` FROM `profiles` `p`
  WHERE `p`.`user_id` = `mpf`.`user_id`
  ORDER BY `p`.`is_default` DESC, (`p`.`relationship` = 'SELF') DESC, `p`.`created_at` ASC
  LIMIT 1
)
WHERE `mpf`.`profile_id` IS NULL;

CREATE INDEX `marketplace_professional_favorites_profile_id_idx` ON `marketplace_professional_favorites`(`profile_id`);
ALTER TABLE `marketplace_professional_favorites`
  ADD CONSTRAINT `marketplace_professional_favorites_profile_id_fkey`
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX `marketplace_professional_favorites_user_id_employee_id_key` ON `marketplace_professional_favorites`;
CREATE UNIQUE INDEX `mp_prof_fav_user_profile_emp_key`
  ON `marketplace_professional_favorites`(`user_id`, `profile_id`, `employee_id`);
