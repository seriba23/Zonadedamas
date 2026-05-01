-- =====================================================================
-- UNIFIED AUTH MIGRATION
-- Fusiona marketplace_users en users. Una sola tabla de login.
-- Datos preservados: TODO (in-place merge).
-- =====================================================================

-- ─── 1. Quitar unique compuesto y FK de users ──────────────────────────
ALTER TABLE `users` DROP FOREIGN KEY `users_tenant_id_fkey`;
ALTER TABLE `users` DROP INDEX `users_tenant_id_email_key`;
ALTER TABLE `users` DROP INDEX `users_tenant_id_idx`;

-- ─── 2. tenant_id nullable + nuevas columnas ───────────────────────────
ALTER TABLE `users`
  MODIFY COLUMN `tenant_id` VARCHAR(191) DEFAULT NULL,
  MODIFY COLUMN `password_hash` VARCHAR(191) DEFAULT NULL,
  ADD COLUMN `is_client` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `social_provider` VARCHAR(20) DEFAULT NULL,
  ADD COLUMN `social_id` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN `birth_date` DATE DEFAULT NULL,
  ADD COLUMN `gender` VARCHAR(20) DEFAULT NULL,
  ADD COLUMN `allergies` TEXT DEFAULT NULL,
  ADD COLUMN `address` TEXT DEFAULT NULL,
  ADD COLUMN `country` VARCHAR(2) DEFAULT NULL,
  ADD COLUMN `language` VARCHAR(5) NOT NULL DEFAULT 'es',
  ADD COLUMN `currency` VARCHAR(10) NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `search_radius` INT NOT NULL DEFAULT 25,
  ADD COLUMN `notif_appointments` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `notif_promotions` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `notif_rewards` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `notif_messages` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `suspended_at` DATETIME(3) DEFAULT NULL,
  ADD COLUMN `suspended_until` DATETIME(3) DEFAULT NULL;

-- ─── 3. Marcar usuarios existentes (los de negocio) como no-cliente ────
-- (ya está en false por default). Los que vienen de marketplace_users
-- se insertan con is_client=true a continuación.

-- ─── 4. Copiar marketplace_users → users ───────────────────────────────
INSERT INTO `users` (
  `id`, `tenant_id`, `email`, `phone`, `password_hash`,
  `first_name`, `last_name`, `avatar_url`,
  `is_active`, `last_login_at`, `created_at`, `updated_at`,
  `is_client`, `social_provider`, `social_id`,
  `birth_date`, `gender`, `allergies`, `address`,
  `country`, `language`, `currency`, `search_radius`,
  `notif_appointments`, `notif_promotions`, `notif_rewards`, `notif_messages`,
  `suspended_at`, `suspended_until`
)
SELECT
  `id`, NULL, `email`, `phone`, `password_hash`,
  `first_name`, `last_name`, `avatar_url`,
  `is_active`, `last_login_at`, `created_at`, `updated_at`,
  TRUE, `social_provider`, `social_id`,
  `birth_date`, `gender`, `allergies`, `address`,
  `country`, `language`, `currency`, `search_radius`,
  `notif_appointments`, `notif_promotions`, `notif_rewards`, `notif_messages`,
  `suspended_at`, `suspended_until`
FROM `marketplace_users`;

-- ─── 5. Indexes nuevos en users ────────────────────────────────────────
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);
CREATE INDEX `users_tenant_id_idx` ON `users`(`tenant_id`);
CREATE INDEX `users_is_client_idx` ON `users`(`is_client`);

-- Restablecer FK de tenant_id (ahora nullable)
ALTER TABLE `users`
  ADD CONSTRAINT `users_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 6. Repuntar FKs en clients ────────────────────────────────────────
ALTER TABLE `clients` DROP FOREIGN KEY `clients_marketplace_user_id_fkey`;
ALTER TABLE `clients` DROP INDEX `clients_marketplace_user_id_idx`;
ALTER TABLE `clients` CHANGE COLUMN `marketplace_user_id` `user_id` VARCHAR(191) DEFAULT NULL;
CREATE INDEX `clients_user_id_idx` ON `clients`(`user_id`);
ALTER TABLE `clients`
  ADD CONSTRAINT `clients_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 7. Repuntar marketplace_favorites ────────────────────────────────
ALTER TABLE `marketplace_favorites` DROP FOREIGN KEY `marketplace_favorites_marketplace_user_id_fkey`;
ALTER TABLE `marketplace_favorites` DROP INDEX `marketplace_favorites_marketplace_user_id_tenant_id_key`;
ALTER TABLE `marketplace_favorites` DROP INDEX `marketplace_favorites_marketplace_user_id_idx`;
ALTER TABLE `marketplace_favorites` CHANGE COLUMN `marketplace_user_id` `user_id` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `marketplace_favorites_user_id_tenant_id_key` ON `marketplace_favorites`(`user_id`, `tenant_id`);
CREATE INDEX `marketplace_favorites_user_id_idx` ON `marketplace_favorites`(`user_id`);
ALTER TABLE `marketplace_favorites`
  ADD CONSTRAINT `marketplace_favorites_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 8. Repuntar marketplace_professional_favorites ───────────────────
ALTER TABLE `marketplace_professional_favorites` DROP FOREIGN KEY `marketplace_professional_favorites_marketplace_user_id_fkey`;
ALTER TABLE `marketplace_professional_favorites` DROP INDEX `marketplace_professional_favorites_marketplace_user_id_emplo_key`;
ALTER TABLE `marketplace_professional_favorites` DROP INDEX `marketplace_professional_favorites_marketplace_user_id_idx`;
ALTER TABLE `marketplace_professional_favorites` CHANGE COLUMN `marketplace_user_id` `user_id` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `mpf_user_id_employee_id_key` ON `marketplace_professional_favorites`(`user_id`, `employee_id`);
CREATE INDEX `mpf_user_id_idx` ON `marketplace_professional_favorites`(`user_id`);
ALTER TABLE `marketplace_professional_favorites`
  ADD CONSTRAINT `mpf_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 9. Repuntar product_reservations (sin FK previa) ─────────────────
ALTER TABLE `product_reservations` CHANGE COLUMN `marketplace_user_id` `user_id` VARCHAR(191) DEFAULT NULL;
CREATE INDEX `product_reservations_user_id_idx` ON `product_reservations`(`user_id`);
ALTER TABLE `product_reservations`
  ADD CONSTRAINT `product_reservations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 10. Drop tablas legacy ───────────────────────────────────────────
DROP TABLE `marketplace_refresh_tokens`;
DROP TABLE `marketplace_users`;
