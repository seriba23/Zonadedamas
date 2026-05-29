-- Flag para "no mostrar" foto en perfil publico sin eliminarla del
-- portafolio personal del empleado.
ALTER TABLE `employee_portfolio_images`
  ADD COLUMN `is_hidden` BOOLEAN NOT NULL DEFAULT false;
