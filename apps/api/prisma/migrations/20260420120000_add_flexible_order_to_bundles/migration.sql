-- AlterTable
ALTER TABLE `service_bundles` ADD COLUMN `flexible_order` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `bundle_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_bundle_id_fkey` FOREIGN KEY (`bundle_id`) REFERENCES `service_bundles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `appointments_bundle_id_idx` ON `appointments`(`bundle_id`);
