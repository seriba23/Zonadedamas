-- DropIndex
DROP INDEX `refresh_tokens_token_hash_idx` ON `refresh_tokens`;

-- AlterTable
ALTER TABLE `refresh_tokens` ADD COLUMN `token_hint` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX `refresh_tokens_token_hint_idx` ON `refresh_tokens`(`token_hint`);
