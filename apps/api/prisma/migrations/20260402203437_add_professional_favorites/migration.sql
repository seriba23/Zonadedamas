-- CreateTable
CREATE TABLE `marketplace_professional_favorites` (
    `id` VARCHAR(191) NOT NULL,
    `marketplace_user_id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketplace_professional_favorites_marketplace_user_id_idx`(`marketplace_user_id`),
    UNIQUE INDEX `marketplace_professional_favorites_marketplace_user_id_emplo_key`(`marketplace_user_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `marketplace_professional_favorites` ADD CONSTRAINT `marketplace_professional_favorites_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `marketplace_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marketplace_professional_favorites` ADD CONSTRAINT `marketplace_professional_favorites_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
