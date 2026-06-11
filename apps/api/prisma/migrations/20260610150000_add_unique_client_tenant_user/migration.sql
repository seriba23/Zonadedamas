-- Unique constraint para bloquear duplicados de Client por (tenant, marketplace user).
-- Motivo: se detectaron 3 filas "Alfredo Ibarra" para el mismo marketplace user
-- en distintos tenants (caso legítimo) PERO la lógica de booking podía crear
-- duplicados dentro del MISMO tenant si dos requests pasaban findFirst a la vez.
-- Este índice bloquea esa condición a nivel DB.
--
-- MySQL permite múltiples NULLs en un índice único, así que walk-in clients
-- sin userId no son afectados.

ALTER TABLE `clients`
  ADD UNIQUE INDEX `clients_tenant_id_user_id_key`(`tenant_id`, `user_id`);
