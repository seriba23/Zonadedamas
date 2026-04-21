-- AlterTable: expand resources with asset management fields
ALTER TABLE `resources` ADD COLUMN `notes` TEXT NULL;
ALTER TABLE `resources` ADD COLUMN `image_url` VARCHAR(191) NULL;
ALTER TABLE `resources` ADD COLUMN `value` DECIMAL(10, 2) NULL;
ALTER TABLE `resources` ADD COLUMN `serial_number` VARCHAR(191) NULL;
ALTER TABLE `resources` ADD COLUMN `brand` VARCHAR(191) NULL;
ALTER TABLE `resources` ADD COLUMN `condition` VARCHAR(191) NULL DEFAULT 'good';
ALTER TABLE `resources` ADD COLUMN `assigned_to` VARCHAR(191) NULL;
ALTER TABLE `resources` ADD COLUMN `assigned_at` DATETIME(3) NULL;
ALTER TABLE `resources` ADD COLUMN `purchase_date` DATE NULL;

-- CreateIndex
CREATE INDEX `resources_tenant_id_assigned_to_idx` ON `resources`(`tenant_id`, `assigned_to`);
