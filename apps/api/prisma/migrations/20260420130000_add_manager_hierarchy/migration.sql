-- AlterTable
ALTER TABLE `employees` ADD COLUMN `manager_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `employees_manager_id_idx` ON `employees`(`manager_id`);
