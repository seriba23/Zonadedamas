-- Adds tenant-level toggle to disable the confetti animation shown to clients
-- after a successful booking. Default true (existing behavior preserved).
ALTER TABLE `tenants` ADD COLUMN `confetti_enabled` BOOLEAN NOT NULL DEFAULT true;
