-- AlterTable: agrega product_reservation_id a payments para soportar
-- cobros de apartados standalone (sin cita o con cita cancelada).
ALTER TABLE `payments`
  ADD COLUMN `product_reservation_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `payments_product_reservation_id_idx` ON `payments`(`product_reservation_id`);

-- AddForeignKey
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_product_reservation_id_fkey`
  FOREIGN KEY (`product_reservation_id`) REFERENCES `product_reservations`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
