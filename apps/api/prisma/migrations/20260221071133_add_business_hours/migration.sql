-- AlterTable
ALTER TABLE `employees` MODIFY `color` VARCHAR(191) NOT NULL DEFAULT '#008080';

-- CreateTable
CREATE TABLE `business_hours` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `day_of_week` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `open_time` VARCHAR(191) NOT NULL,
    `close_time` VARCHAR(191) NOT NULL,
    `is_open` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `business_hours_tenant_id_day_of_week_key`(`tenant_id`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_hours` ADD CONSTRAINT `business_hours_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
