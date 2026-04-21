-- AlterTable
ALTER TABLE `product_reservations` ADD COLUMN `appointment_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `product_reservations` ADD CONSTRAINT `product_reservations_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `product_reservations_appointment_id_idx` ON `product_reservations`(`appointment_id`);
