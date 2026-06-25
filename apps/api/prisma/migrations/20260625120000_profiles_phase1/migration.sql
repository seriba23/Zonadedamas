-- Perfiles estilo Netflix: un User (tutor) con varios Profile (él + sus hijos).
-- Migración ADITIVA y segura: no toca `appointments`, solo agrega tablas/columnas
-- y reemplaza el unique de `clients` de (tenant_id, user_id) a (tenant_id, profile_id).

-- CreateTable: profiles
CREATE TABLE `profiles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(10) NOT NULL DEFAULT 'SELF',
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `avatar_url` VARCHAR(191) NULL,
    `date_of_birth` DATE NULL,
    `gender` VARCHAR(20) NULL,
    `allergies` TEXT NULL,
    `is_minor` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `profiles_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: agregar profile_id a clients (nullable para no romper walk-ins)
ALTER TABLE `clients` ADD COLUMN `profile_id` VARCHAR(191) NULL;

-- Backfill: crear un perfil SELF por cada usuario de marketplace y por cada
-- usuario referenciado por algún client (para no dejar fichas huérfanas).
INSERT INTO `profiles` (`id`, `user_id`, `relationship`, `first_name`, `last_name`, `avatar_url`, `date_of_birth`, `gender`, `allergies`, `is_minor`, `is_default`, `created_at`, `updated_at`)
SELECT UUID(), u.`id`, 'SELF', u.`first_name`, u.`last_name`, u.`avatar_url`, u.`birth_date`, u.`gender`, u.`allergies`, 0, 1, NOW(3), NOW(3)
FROM `users` u
WHERE u.`is_client` = 1
   OR u.`id` IN (SELECT DISTINCT `user_id` FROM `clients` WHERE `user_id` IS NOT NULL);

-- Backfill: enlazar cada client (que ya tenga user_id) a su perfil SELF.
UPDATE `clients` c
JOIN `profiles` p ON p.`user_id` = c.`user_id` AND p.`relationship` = 'SELF'
SET c.`profile_id` = p.`id`
WHERE c.`user_id` IS NOT NULL;

-- Reemplazar el unique: quitar (tenant_id, user_id) y crear (tenant_id, profile_id).
-- Nota: si esta sentencia fallara por duplicados, correr antes el pre-check:
--   SELECT tenant_id, profile_id, COUNT(*) FROM clients
--   WHERE profile_id IS NOT NULL GROUP BY tenant_id, profile_id HAVING COUNT(*)>1;
ALTER TABLE `clients` DROP INDEX `clients_tenant_id_user_id_key`;
CREATE UNIQUE INDEX `clients_tenant_id_profile_id_key` ON `clients`(`tenant_id`, `profile_id`);
CREATE INDEX `clients_profile_id_idx` ON `clients`(`profile_id`);

-- Foreign keys
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clients` ADD CONSTRAINT `clients_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
