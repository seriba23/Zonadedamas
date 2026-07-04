-- Costo de envío plano por pedido a nivel tienda (se cobra una sola vez por
-- compra a domicilio, sin importar cuántos productos lleve el carrito).
-- Aditiva, nullable.
ALTER TABLE `tenants`
  ADD COLUMN `shop_shipping_cost` DECIMAL(10, 2) NULL;
