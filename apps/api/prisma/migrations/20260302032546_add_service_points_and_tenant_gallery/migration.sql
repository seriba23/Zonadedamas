-- AlterTable
ALTER TABLE `services` ADD COLUMN `points_required` INTEGER NULL,
    ADD COLUMN `redeemable_with_points` BOOLEAN NOT NULL DEFAULT false;
