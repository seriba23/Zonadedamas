-- Pago de comisiones del negocio al empleado, con confirmación del empleado.
CREATE TABLE `commission_payments` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `employee_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `paid_by_user_id` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `confirmed_at` DATETIME(3) NULL,
  `disputed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `commission_payments_tenant_id_idx` (`tenant_id`),
  INDEX `commission_payments_employee_id_status_idx` (`employee_id`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `commission_payments`
  ADD CONSTRAINT `commission_payments_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `commission_payments`
  ADD CONSTRAINT `commission_payments_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
