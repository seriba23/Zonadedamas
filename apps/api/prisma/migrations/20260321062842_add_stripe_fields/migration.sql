-- AlterTable
ALTER TABLE `payments` ADD COLUMN `stripe_payment_intent_id` VARCHAR(191) NULL,
    ADD COLUMN `stripe_session_id` VARCHAR(191) NULL,
    MODIFY `payment_method` ENUM('CASH', 'CARD', 'TRANSFER', 'STRIPE', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `stripe_account_id` VARCHAR(191) NULL,
    ADD COLUMN `stripe_onboarding_complete` BOOLEAN NOT NULL DEFAULT false;
