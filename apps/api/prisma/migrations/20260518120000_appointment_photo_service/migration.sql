-- AlterTable
ALTER TABLE `appointment_photos` ADD COLUMN `service_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `appointment_photos_service_id_idx` ON `appointment_photos`(`service_id`);

-- AddForeignKey
ALTER TABLE `appointment_photos` ADD CONSTRAINT `appointment_photos_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
