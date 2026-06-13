-- AlterTable: agrega commission_type a employee_services con default 'AMOUNT'
ALTER TABLE `employee_services`
  ADD COLUMN `commission_type` VARCHAR(10) NOT NULL DEFAULT 'AMOUNT';
