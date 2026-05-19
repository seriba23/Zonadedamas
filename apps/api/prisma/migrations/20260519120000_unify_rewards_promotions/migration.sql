-- ============================================================
-- Unificacion Cupones (Reward) + Promociones (Promotion).
-- Se extiende rewards con los campos faltantes de promotions,
-- se crea reward_referrals (equivalente a promotion_referrals),
-- y se migran los datos.
-- ============================================================

-- 1. ALTER TABLE rewards: campos nuevos
ALTER TABLE `rewards` MODIFY COLUMN `points_required` INT NULL;
ALTER TABLE `rewards` ADD COLUMN `service_ids` JSON NULL;
ALTER TABLE `rewards` ADD COLUMN `start_date` DATETIME(3) NULL;
ALTER TABLE `rewards` ADD COLUMN `end_date` DATETIME(3) NULL;
ALTER TABLE `rewards` ADD COLUMN `code` VARCHAR(50) NULL;
ALTER TABLE `rewards` ADD COLUMN `min_amount` DECIMAL(10, 2) NULL;
ALTER TABLE `rewards` ADD COLUMN `allow_point_payment` BOOLEAN NOT NULL DEFAULT 1;

-- Indice para code (busqueda por codigo publico)
CREATE INDEX `rewards_code_idx` ON `rewards`(`code`);

-- 2. CREATE TABLE reward_referrals (clone de promotion_referrals)
CREATE TABLE `reward_referrals` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `reward_id` VARCHAR(191) NOT NULL,
  `appointment_id` VARCHAR(191) NOT NULL,
  `service_ids` JSON NOT NULL,
  `code` VARCHAR(12) NOT NULL,
  `generated_by_client_id` VARCHAR(191) NOT NULL,
  `redeemed_by_client_id` VARCHAR(191) NULL,
  `redeemed_appointment_id` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `used_at` DATETIME(3) NULL,

  UNIQUE INDEX `reward_referrals_code_key`(`code`),
  INDEX `reward_referrals_tenant_id_idx`(`tenant_id`),
  INDEX `reward_referrals_code_idx`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `reward_referrals`
  ADD CONSTRAINT `reward_referrals_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `reward_referrals_reward_id_fkey`
  FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- 3. MIGRAR datos: promotions -> rewards
-- Mapping de tipos:
--   PERCENTAGE     -> DESCUENTO + discount_mode='PERCENTAGE' + discount_amount=value
--   FIXED_AMOUNT   -> DESCUENTO + discount_mode='FLAT'       + discount_amount=value
--   TWO_FOR_ONE    -> TWO_FOR_ONE + value (no se usa pero lo guardamos)
INSERT INTO `rewards` (
  `id`, `tenant_id`, `name`, `description`,
  `type`, `points_required`, `discount_amount`, `discount_mode`,
  `service_ids`, `start_date`, `end_date`, `code`, `min_amount`,
  `allow_point_payment`, `is_active`, `max_redemptions`, `times_redeemed`,
  `valid_until`, `created_at`, `updated_at`
)
SELECT
  p.`id`,
  p.`tenant_id`,
  p.`name`,
  p.`description`,
  CASE
    WHEN p.`type` = 'PERCENTAGE'   THEN 'DESCUENTO'
    WHEN p.`type` = 'FIXED_AMOUNT' THEN 'DESCUENTO'
    WHEN p.`type` = 'TWO_FOR_ONE'  THEN 'TWO_FOR_ONE'
    ELSE p.`type`
  END AS `type`,
  NULL AS `points_required`,
  CASE
    WHEN p.`type` IN ('PERCENTAGE', 'FIXED_AMOUNT') THEN p.`value`
    ELSE NULL
  END AS `discount_amount`,
  CASE
    WHEN p.`type` = 'PERCENTAGE'   THEN 'PERCENTAGE'
    WHEN p.`type` = 'FIXED_AMOUNT' THEN 'FLAT'
    ELSE NULL
  END AS `discount_mode`,
  p.`service_ids`,
  p.`start_date`,
  p.`end_date`,
  p.`code`,
  p.`min_amount`,
  p.`allow_point_payment`,
  p.`is_active`,
  p.`max_uses` AS `max_redemptions`,
  p.`used_count` AS `times_redeemed`,
  p.`end_date` AS `valid_until`,
  p.`created_at`,
  p.`updated_at`
FROM `promotions` p
-- Evitar colisiones de id (rewards y promotions son tablas separadas con uuid).
WHERE p.`id` NOT IN (SELECT `id` FROM `rewards`);

-- 4. MIGRAR promotion_referrals -> reward_referrals
INSERT INTO `reward_referrals` (
  `id`, `tenant_id`, `reward_id`, `appointment_id`, `service_ids`,
  `code`, `generated_by_client_id`, `redeemed_by_client_id`,
  `redeemed_appointment_id`, `status`, `expires_at`, `created_at`, `used_at`
)
SELECT
  pr.`id`,
  pr.`tenant_id`,
  pr.`promotion_id` AS `reward_id`,
  pr.`appointment_id`,
  pr.`service_ids`,
  pr.`code`,
  pr.`generated_by_client_id`,
  pr.`redeemed_by_client_id`,
  pr.`redeemed_appointment_id`,
  pr.`status`,
  pr.`expires_at`,
  pr.`created_at`,
  pr.`used_at`
FROM `promotion_referrals` pr
WHERE pr.`id` NOT IN (SELECT `id` FROM `reward_referrals`);

-- NOTA: las tablas `promotions` y `promotion_referrals` NO se dropean
-- en esta migration por seguridad. Quedan como respaldo. Una migration
-- posterior puede dropearlas cuando se confirme que todo funciona.
