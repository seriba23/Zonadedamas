-- AlterTable
ALTER TABLE `service_bundles` ADD COLUMN `points_required` INTEGER NULL,
    ADD COLUMN `points_reward` INTEGER NULL,
    ADD COLUMN `redeemable_with_points` BOOLEAN NOT NULL DEFAULT false;
