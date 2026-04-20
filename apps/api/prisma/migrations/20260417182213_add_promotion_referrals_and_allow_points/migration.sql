-- AlterTable
ALTER TABLE `promotions` ADD COLUMN `allow_point_payment` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `promotion_referrals` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `promotion_id` VARCHAR(191) NOT NULL,
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

    UNIQUE INDEX `promotion_referrals_code_key`(`code`),
    INDEX `promotion_referrals_tenant_id_idx`(`tenant_id`),
    INDEX `promotion_referrals_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `promotion_referrals` ADD CONSTRAINT `promotion_referrals_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_referrals` ADD CONSTRAINT `promotion_referrals_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
