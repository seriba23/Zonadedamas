-- Flag para destacar fotos del portafolio del empleado. Las destacadas
-- aparecen primero en el perfil publico del marketplace.
ALTER TABLE `employee_portfolio_images`
  ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false;
