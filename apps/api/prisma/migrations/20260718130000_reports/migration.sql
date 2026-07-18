-- Reportes/denuncias a la plataforma (super-admin). Tabla nueva.
CREATE TABLE `reports` (
    `id` VARCHAR(191) NOT NULL,
    `reporter_type` VARCHAR(191) NOT NULL,
    `reporter_id` VARCHAR(191) NULL,
    `reporter_name` VARCHAR(191) NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `target_name` VARCHAR(191) NULL,
    `tenant_id` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN') NOT NULL DEFAULT 'PENDING',
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reports_status_idx`(`status`),
    INDEX `reports_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
