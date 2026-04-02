/*
  Warnings:

  - A unique constraint covering the columns `[name,category]` on the table `service_catalog` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `service_catalog_name_key` ON `service_catalog`;

-- CreateIndex
CREATE UNIQUE INDEX `service_catalog_name_category_key` ON `service_catalog`(`name`, `category`);
