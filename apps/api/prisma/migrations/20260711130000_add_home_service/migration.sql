-- Servicio a domicilio: flag por servicio, áreas de cobertura por sucursal,
-- direcciones guardadas del cliente y campos de domicilio en la cita.

-- Flag en servicios
ALTER TABLE `services` ADD COLUMN `home_service_enabled` BOOLEAN NOT NULL DEFAULT false;

-- Campos de domicilio en la cita
ALTER TABLE `appointments`
  ADD COLUMN `service_type` VARCHAR(10) NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `delivery_address` TEXT NULL,
  ADD COLUMN `delivery_lat` DOUBLE NULL,
  ADD COLUMN `delivery_lng` DOUBLE NULL,
  ADD COLUMN `home_service_fee` DECIMAL(10, 2) NULL,
  ADD COLUMN `coverage_area_id` VARCHAR(191) NULL;

-- Áreas de cobertura (anillos concéntricos por sucursal)
CREATE TABLE `coverage_areas` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `location_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `radius_km` DOUBLE NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `color` VARCHAR(191) NOT NULL DEFAULT '#008080',
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `coverage_areas_tenant_id_idx`(`tenant_id`),
  INDEX `coverage_areas_location_id_idx`(`location_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Direcciones guardadas del cliente (con coordenadas)
CREATE TABLE `client_addresses` (
  `id` VARCHAR(191) NOT NULL,
  `marketplace_user_id` VARCHAR(191) NOT NULL,
  `profile_id` VARCHAR(191) NULL,
  `label` VARCHAR(191) NULL,
  `address` TEXT NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `longitude` DOUBLE NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `client_addresses_marketplace_user_id_idx`(`marketplace_user_id`),
  INDEX `client_addresses_profile_id_idx`(`profile_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Claves foráneas
ALTER TABLE `coverage_areas` ADD CONSTRAINT `coverage_areas_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `coverage_areas` ADD CONSTRAINT `coverage_areas_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `client_addresses` ADD CONSTRAINT `client_addresses_marketplace_user_id_fkey` FOREIGN KEY (`marketplace_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `client_addresses` ADD CONSTRAINT `client_addresses_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
