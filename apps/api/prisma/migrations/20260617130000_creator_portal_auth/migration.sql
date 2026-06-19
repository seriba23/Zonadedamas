-- AlterTable
ALTER TABLE `influencers` ADD COLUMN `invite_token` VARCHAR(191) NULL,
    ADD COLUMN `invite_token_expires_at` DATETIME(3) NULL,
    ADD COLUMN `last_login_at` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `influencers_invite_token_key` ON `influencers`(`invite_token`);
