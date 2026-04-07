-- AlterTable
ALTER TABLE `products` ADD COLUMN `image_url` VARCHAR(191) NULL,
    ADD COLUMN `is_shop_listed` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `shop_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shop_payment_card` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shop_payment_cash` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `shop_payment_spei` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shop_pickup_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `shop_shipping_enabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `product_images` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_images_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_reservations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_email` VARCHAR(191) NULL,
    `customer_phone` VARCHAR(191) NOT NULL,
    `fulfillment_type` ENUM('PICKUP', 'SHIPPING') NOT NULL,
    `preferred_payment_method` ENUM('CASH', 'SPEI', 'CARD') NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'READY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `shipping_address` TEXT NULL,
    `notes` TEXT NULL,
    `marketplace_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_reservations_tenant_id_idx`(`tenant_id`),
    INDEX `product_reservations_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `product_reservations_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `products_tenant_id_is_shop_listed_is_active_idx` ON `products`(`tenant_id`, `is_shop_listed`, `is_active`);

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reservations` ADD CONSTRAINT `product_reservations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reservations` ADD CONSTRAINT `product_reservations_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
