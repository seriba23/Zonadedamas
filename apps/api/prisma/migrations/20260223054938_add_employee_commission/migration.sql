-- AlterTable
ALTER TABLE `appointment_items` ADD COLUMN `commission_snapshot` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `employee_services` ADD COLUMN `commission` DECIMAL(10, 2) NULL;
