-- CreateTable
CREATE TABLE `notification_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NULL,
    `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP', 'PUSH') NOT NULL,
    `event_name` VARCHAR(191) NOT NULL,
    `recipient_email` VARCHAR(191) NULL,
    `recipient_phone` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('SENT', 'FAILED') NOT NULL,
    `error` TEXT NULL,
    `metadata` JSON NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_logs_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `notification_logs_tenant_id_event_name_idx`(`tenant_id`, `event_name`),
    INDEX `notification_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `notification_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
