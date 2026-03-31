-- AlterTable
ALTER TABLE `subscriptions` ADD COLUMN `advance_paid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `annual_amount_usd` DECIMAL(10, 2) NULL,
    ADD COLUMN `annual_period_end` DATETIME(3) NULL,
    ADD COLUMN `available_licenses` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `plan_interval` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY';
