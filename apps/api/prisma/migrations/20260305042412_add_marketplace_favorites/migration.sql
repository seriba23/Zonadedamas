-- CreateTable
CREATE TABLE `marketplace_favorites` (
    `id` VARCHAR(191) NOT NULL,
    `marketplace_user_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketplace_favorites_marketplace_user_id_idx`(`marketplace_user_id`),
    UNIQUE INDEX `marketplace_favorites_marketplace_user_id_tenant_id_key`(`marketplace_user_id`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketplace_favorites` ADD CONSTRAINT `marketplace_favorites_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketplace_favorites` ADD CONSTRAINT `marketplace_favorites_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
