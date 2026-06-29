-- Crédito del cliente (saldo a favor) + política del anticipo al cancelar.

-- Saldo a favor del cliente (ej. anticipo de cita cancelada dejado como crédito).
ALTER TABLE `clients`
  ADD COLUMN `credit_balance` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Política por defecto del anticipo al cancelar: 'FORFEIT' | 'CREDIT'.
ALTER TABLE `tenants`
  ADD COLUMN `deposit_cancel_policy` VARCHAR(10) NULL;
