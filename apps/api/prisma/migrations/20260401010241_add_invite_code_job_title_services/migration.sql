-- AlterTable
ALTER TABLE `employees` ADD COLUMN `job_title` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tenant_invite_codes` ADD COLUMN `job_title` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tenant_invite_code_services` (
    `id` VARCHAR(191) NOT NULL,
    `invite_code_id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tenant_invite_code_services_invite_code_id_service_id_key`(`invite_code_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tenant_invite_code_services` ADD CONSTRAINT `tenant_invite_code_services_invite_code_id_fkey` FOREIGN KEY (`invite_code_id`) REFERENCES `tenant_invite_codes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_invite_code_services` ADD CONSTRAINT `tenant_invite_code_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
