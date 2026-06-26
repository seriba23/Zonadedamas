-- Color del perfil (hex) para distinguir visualmente cada perfil en las citas.
-- Aditiva: solo agrega una columna nullable.
ALTER TABLE `profiles` ADD COLUMN `color` VARCHAR(191) NULL;
