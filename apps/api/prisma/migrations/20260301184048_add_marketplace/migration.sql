-- AlterTable
ALTER TABLE `clients` ADD COLUMN `marketplace_user_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `locations` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `cover_image_url` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `is_marketplace_listed` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `marketplace_users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `avatar_url` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `marketplace_users_email_key`(`email`),
    UNIQUE INDEX `marketplace_users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketplace_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `marketplace_user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `token_hint` VARCHAR(8) NOT NULL DEFAULT '',
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketplace_refresh_tokens_marketplace_user_id_idx`(`marketplace_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `clients_marketplace_user_id_idx` ON `clients`(`marketplace_user_id`);

-- AddForeignKey
ALTER TABLE `marketplace_refresh_tokens` ADD CONSTRAINT `marketplace_refresh_tokens_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
