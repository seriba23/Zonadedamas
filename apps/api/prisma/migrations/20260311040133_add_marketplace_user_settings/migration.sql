-- AlterTable
ALTER TABLE `marketplace_users` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `birth_date` DATE NULL,
    ADD COLUMN `country` VARCHAR(2) NULL,
    ADD COLUMN `currency` VARCHAR(10) NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN `gender` VARCHAR(20) NULL,
    ADD COLUMN `language` VARCHAR(5) NOT NULL DEFAULT 'es',
    ADD COLUMN `notif_appointments` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notif_promotions` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notif_rewards` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `search_radius` INTEGER NOT NULL DEFAULT 25;
