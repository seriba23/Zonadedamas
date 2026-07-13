-- Añade la marca `from_profile` a client_addresses: indica que la dirección fue
-- derivada automáticamente de la dirección del perfil (geocodificada al guardar).
ALTER TABLE `client_addresses`
  ADD COLUMN `from_profile` BOOLEAN NOT NULL DEFAULT false;
