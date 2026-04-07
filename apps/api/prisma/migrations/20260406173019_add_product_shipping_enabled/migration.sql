-- AlterTable
ALTER TABLE `products` ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT 'MXN',
    ADD COLUMN `shipping_enabled` BOOLEAN NOT NULL DEFAULT false;
