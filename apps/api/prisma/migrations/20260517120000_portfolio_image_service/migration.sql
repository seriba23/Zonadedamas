-- AlterTable
ALTER TABLE `employee_portfolio_images` ADD COLUMN `service_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `employee_portfolio_images_service_id_idx` ON `employee_portfolio_images`(`service_id`);

-- AddForeignKey
ALTER TABLE `employee_portfolio_images` ADD CONSTRAINT `employee_portfolio_images_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
