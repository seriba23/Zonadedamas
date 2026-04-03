-- CreateTable
CREATE TABLE `business_type_catalog` (
    `id` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `business_type_catalog_value_key`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
