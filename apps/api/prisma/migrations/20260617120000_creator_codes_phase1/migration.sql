-- CreateTable
CREATE TABLE `influencers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `approved_at` DATETIME(3) NULL,
    `approved_by` VARCHAR(191) NULL,
    `stripe_account_id` VARCHAR(191) NULL,
    `stripe_onboarding_complete` BOOLEAN NOT NULL DEFAULT false,
    `password_hash` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `influencers_email_key`(`email`),
    UNIQUE INDEX `influencers_stripe_account_id_key`(`stripe_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creator_codes` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `creator_codes_code_key`(`code`),
    INDEX `creator_codes_influencer_id_idx`(`influencer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creator_code_usages` (
    `id` VARCHAR(191) NOT NULL,
    `code_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `discount_months_left` INTEGER NOT NULL DEFAULT 2,
    `cancelled_at` DATETIME(3) NULL,
    `reactivated_at` DATETIME(3) NULL,
    `lost_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `creator_code_usages_tenant_id_key`(`tenant_id`),
    INDEX `creator_code_usages_code_id_idx`(`code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creator_payouts` (
    `id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `usage_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `for_month` VARCHAR(191) NOT NULL,
    `stripe_transfer_id` VARCHAR(191) NULL,
    `transferred_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `creator_payouts_influencer_id_idx`(`influencer_id`),
    UNIQUE INDEX `creator_payouts_usage_id_for_month_key`(`usage_id`, `for_month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `creator_codes` ADD CONSTRAINT `creator_codes_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `creator_code_usages` ADD CONSTRAINT `creator_code_usages_code_id_fkey` FOREIGN KEY (`code_id`) REFERENCES `creator_codes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `creator_payouts` ADD CONSTRAINT `creator_payouts_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `creator_payouts` ADD CONSTRAINT `creator_payouts_usage_id_fkey` FOREIGN KEY (`usage_id`) REFERENCES `creator_code_usages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
