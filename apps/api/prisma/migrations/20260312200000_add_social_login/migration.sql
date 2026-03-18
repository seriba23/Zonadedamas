-- AlterTable: make password_hash optional and add social login fields
ALTER TABLE `marketplace_users` MODIFY COLUMN `password_hash` VARCHAR(191) NULL;
ALTER TABLE `marketplace_users` ADD COLUMN `social_provider` VARCHAR(20) NULL;
ALTER TABLE `marketplace_users` ADD COLUMN `social_id` VARCHAR(255) NULL;
