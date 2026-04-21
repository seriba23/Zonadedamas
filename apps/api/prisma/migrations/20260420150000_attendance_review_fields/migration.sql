-- AlterTable: add review and distance fields to attendances
ALTER TABLE `attendances` ADD COLUMN `check_in_distance` DOUBLE NULL;
ALTER TABLE `attendances` ADD COLUMN `check_out_distance` DOUBLE NULL;
ALTER TABLE `attendances` ADD COLUMN `status` ENUM('APPROVED', 'PENDING_REVIEW', 'REJECTED') NOT NULL DEFAULT 'APPROVED';
ALTER TABLE `attendances` ADD COLUMN `reviewed_by` VARCHAR(191) NULL;
ALTER TABLE `attendances` ADD COLUMN `reviewed_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `attendances_tenant_id_status_idx` ON `attendances`(`tenant_id`, `status`);
