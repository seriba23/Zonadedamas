-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `photo_consent` BOOLEAN NULL,
    ADD COLUMN `photo_consent_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `employee_reviews` ADD COLUMN `business_comment` TEXT NULL,
    ADD COLUMN `business_rating` INTEGER NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `base_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `employee_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `employee_count` INTEGER NULL,
    ADD COLUMN `stripe_invoice_id` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `subscriptions` ADD COLUMN `base_monthly_usd` DECIMAL(10, 2) NOT NULL DEFAULT 10,
    ADD COLUMN `billed_employee_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `per_employee_usd` DECIMAL(10, 2) NOT NULL DEFAULT 10,
    ADD COLUMN `stripe_customer_id` VARCHAR(255) NULL,
    ADD COLUMN `stripe_price_id` VARCHAR(255) NULL,
    ADD COLUMN `stripe_subscription_id` VARCHAR(255) NULL,
    ADD COLUMN `trial_ends_at` DATETIME(3) NULL;
