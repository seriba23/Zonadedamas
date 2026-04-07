-- AlterTable
ALTER TABLE `product_reservations` ADD COLUMN `shipping_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `shipping_cost` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `shop_spei_bank_name` VARCHAR(191) NULL,
    ADD COLUMN `shop_spei_clabe` VARCHAR(18) NULL,
    ADD COLUMN `shop_spei_holder_name` VARCHAR(191) NULL;
