-- AlterTable
ALTER TABLE `marketplace_users` ADD COLUMN `suspended_at` DATETIME(3) NULL,
    ADD COLUMN `suspended_until` DATETIME(3) NULL,
    ADD COLUMN `notif_messages` BOOLEAN NOT NULL DEFAULT true;
