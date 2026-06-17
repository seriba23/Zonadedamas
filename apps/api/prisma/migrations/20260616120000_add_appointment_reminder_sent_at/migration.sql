-- AlterTable: añade columna reminder_sent_at a appointments.
-- Usado por el flujo de recordatorios WhatsApp del admin: se setea al
-- pulsar el boton "Recordatorio WhatsApp" y permite filtrar las
-- citas que ya fueron recordadas hoy.
ALTER TABLE `appointments` ADD COLUMN `reminder_sent_at` DATETIME(3) NULL;
