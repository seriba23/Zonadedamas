-- DropForeignKey
ALTER TABLE `marketplace_professional_favorites` DROP FOREIGN KEY `mpf_user_id_fkey`;

-- AddForeignKey
ALTER TABLE `marketplace_professional_favorites` ADD CONSTRAINT `marketplace_professional_favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `marketplace_professional_favorites_user_id_employee_id_key` ON `marketplace_professional_favorites`(`user_id`, `employee_id`);
DROP INDEX `mpf_user_id_employee_id_key` ON `marketplace_professional_favorites`;

-- RedefineIndex
CREATE INDEX `marketplace_professional_favorites_user_id_idx` ON `marketplace_professional_favorites`(`user_id`);
DROP INDEX `mpf_user_id_idx` ON `marketplace_professional_favorites`;
