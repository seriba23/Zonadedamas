-- AlterTable
ALTER TABLE `employees` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `blood_type` VARCHAR(5) NULL,
    ADD COLUMN `emergency_contact_last_name` VARCHAR(191) NULL,
    ADD COLUMN `emergency_contact_name` VARCHAR(191) NULL,
    ADD COLUMN `emergency_contact_phone` VARCHAR(191) NULL,
    ADD COLUMN `emergency_contact_relation` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `document_type` VARCHAR(50) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_documents_employee_id_idx`(`employee_id`),
    UNIQUE INDEX `employee_documents_employee_id_document_type_key`(`employee_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_trainings` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `institution` VARCHAR(200) NULL,
    `date_completed` DATE NULL,
    `file_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_trainings_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_trainings` ADD CONSTRAINT `employee_trainings_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
