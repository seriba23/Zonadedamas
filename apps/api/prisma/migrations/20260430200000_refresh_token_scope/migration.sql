-- AlterTable: añadir scope para distinguir tokens de business vs client
ALTER TABLE `refresh_tokens` ADD COLUMN `scope` VARCHAR(20) NOT NULL DEFAULT 'business';
CREATE INDEX `refresh_tokens_scope_idx` ON `refresh_tokens`(`scope`);
