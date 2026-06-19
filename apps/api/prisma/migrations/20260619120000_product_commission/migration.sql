-- AlterTable
ALTER TABLE `products` ADD COLUMN `commission` DECIMAL(10, 2) NULL,
    ADD COLUMN `commission_type` VARCHAR(10) NOT NULL DEFAULT 'AMOUNT';
