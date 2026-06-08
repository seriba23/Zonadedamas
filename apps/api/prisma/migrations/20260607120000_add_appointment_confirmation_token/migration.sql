-- Token publico que el empleado genera al cerrar una cita: el cliente abre
-- /confirm-payment/{token} desde el QR, ve el desglose, confirma el cobro y
-- deja su reseña. confirmation_token es nullable (no todas las citas viejas
-- lo tendran) y unico (es el bearer de la pagina publica).
ALTER TABLE `appointments`
  ADD COLUMN `confirmation_token` VARCHAR(191) NULL,
  ADD COLUMN `confirmed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `appointments_confirmation_token_key` ON `appointments`(`confirmation_token`);
