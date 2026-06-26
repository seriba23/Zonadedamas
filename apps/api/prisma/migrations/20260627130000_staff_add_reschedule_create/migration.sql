-- Backfill: el rol "Empleado" (slug='staff') de TODOS los tenants existentes
-- gana los permisos appointments.reschedule y appointments.create, para que el
-- empleado pueda reagendar y agregar servicios desde el detalle de cita.
-- NO se le da appointments.cancel (cancelar queda para admin/recepción).
-- Idempotente: NOT EXISTS respeta la PK compuesta (role_id, permission_id).

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`module` = 'appointments' AND p.`action` = 'reschedule'
WHERE r.`slug` = 'staff'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`module` = 'appointments' AND p.`action` = 'create'
WHERE r.`slug` = 'staff'
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`role_id` = r.`id` AND rp.`permission_id` = p.`id`
  );
