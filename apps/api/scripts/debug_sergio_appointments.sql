-- Diagnóstico: por qué Sergio no ve sus citas en /marketplace/appointments
-- Verifica la cadena User -> Client(s) -> Appointment(s) y el filtro de fecha/status.

-- 1) ¿Existe el User y qué Clients tiene asociados?
SELECT 'CLIENTS DEL USER' AS section;
SELECT
  u.id   AS userId,
  u.email,
  c.id   AS clientId,
  c.tenant_id,
  t.slug AS tenantSlug,
  c.first_name,
  c.email AS client_email,
  c.user_id AS client_userId
FROM users u
LEFT JOIN clients c ON c.user_id = u.id
LEFT JOIN tenants t ON t.id = c.tenant_id
WHERE u.email = 'sergioibarra275@gmail.com';

-- 2) Citas asociadas a esos Clients (todas, sin filtros)
SELECT 'TODAS LAS CITAS' AS section;
SELECT
  a.id,
  a.tenant_id,
  t.slug AS tenantSlug,
  a.client_id,
  a.start_time,
  a.status,
  a.created_at,
  CONCAT(e.first_name,' ',e.last_name) AS empleado
FROM appointments a
JOIN clients c ON c.id = a.client_id
JOIN users   u ON u.id = c.user_id
LEFT JOIN tenants  t ON t.id = a.tenant_id
LEFT JOIN employees e ON e.id = a.employee_id
WHERE u.email = 'sergioibarra275@gmail.com'
ORDER BY a.start_time DESC;

-- 3) ¿Existen Clients con el mismo email pero SIN userId asociado?
--    (Si la cita se creo cuando el Client aun no tenia userId, no aparece
--    en /my-appointments porque el endpoint filtra por userId.)
SELECT 'CLIENTS CON EMAIL DE SERGIO SIN userId' AS section;
SELECT
  c.id,
  c.tenant_id,
  c.first_name,
  c.email,
  c.user_id,
  COUNT(a.id) AS num_citas
FROM clients c
LEFT JOIN appointments a ON a.client_id = c.id
WHERE c.email = 'sergioibarra275@gmail.com'
  AND c.user_id IS NULL
GROUP BY c.id, c.tenant_id, c.first_name, c.email, c.user_id;

-- 4) Comparar start_time vs NOW() (para entender filtro "upcoming")
SELECT 'CITAS VS AHORA' AS section;
SELECT
  NOW() AS now_real_utc,
  DATE_SUB(NOW(), INTERVAL 6 HOUR) AS now_simulado_marketplace,
  a.id,
  a.start_time,
  a.status,
  CASE WHEN a.start_time >= DATE_SUB(NOW(), INTERVAL 6 HOUR) THEN 'UPCOMING' ELSE 'PAST' END AS filtro_calc
FROM appointments a
JOIN clients c ON c.id = a.client_id
JOIN users   u ON u.id = c.user_id
WHERE u.email = 'sergioibarra275@gmail.com'
ORDER BY a.start_time DESC;
