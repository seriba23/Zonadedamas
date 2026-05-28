-- ============================================================
-- Fix de drift entre schema.prisma y la DB.
-- Los campos paymentProofUrl y ProductReservation.code estaban
-- declarados en el schema pero ninguna migracion los habia creado.
-- Tambien re-crea el FK reward_referrals->rewards con la accion
-- onDelete correcta segun el schema.
-- Generado con: prisma migrate diff --from-url ... --to-schema-datamodel
-- ============================================================

-- DropForeignKey (se recrea abajo con la accion correcta)
ALTER TABLE `reward_referrals` DROP FOREIGN KEY `reward_referrals_reward_id_fkey`;

-- AlterTable: comprobante de pago en appointments
ALTER TABLE `appointments` ADD COLUMN `payment_proof_url` VARCHAR(191) NULL;

-- AlterTable: comprobante de pago + codigo corto en product_reservations
ALTER TABLE `product_reservations`
  ADD COLUMN `code` VARCHAR(191) NULL,
  ADD COLUMN `payment_proof_url` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `product_reservations_code_key` ON `product_reservations`(`code`);

-- AddForeignKey (re-crear con onDelete: Restrict / onUpdate: Cascade)
ALTER TABLE `reward_referrals`
  ADD CONSTRAINT `reward_referrals_reward_id_fkey`
  FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
