/*
  Warnings:

  - A unique constraint covering the columns `[redemption_id]` on the table `appointments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `discount_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `redemption_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `appointments_redemption_id_key` ON `appointments`(`redemption_id`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_redemption_id_fkey` FOREIGN KEY (`redemption_id`) REFERENCES `reward_redemptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
