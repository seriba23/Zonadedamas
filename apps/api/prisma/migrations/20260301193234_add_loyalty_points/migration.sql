-- AlterTable
ALTER TABLE `clients` ADD COLUMN `loyalty_points` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `points_reward` INTEGER NULL;
