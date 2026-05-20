-- Rastrea cupón -15% de Sergio Ibarra en Demo Salon.
-- Devuelve datos del redemption + audit log (quién lo creó y cuándo).
-- Si fue regalado desde el dashboard, audit_log tendrá la fila con el admin
-- que clickeó "Regalar cupón". Si fue canjeado por puntos por el usuario,
-- points_spent > 0 y normalmente no hay audit log (redeemReward no audita).

SELECT
  rr.id              AS redemption_id,
  rr.code,
  rr.points_spent,
  rr.status,
  rr.created_at      AS canjeado_en,
  rr.used_at,
  rr.expires_at,
  r.name             AS reward_name,
  r.type             AS reward_type,
  r.discount_mode,
  r.discount_amount,
  r.points_required,
  al.action          AS audit_action,
  al.user_id         AS performed_by_user_id,
  ua.email           AS performed_by_email,
  ua.first_name      AS performed_by_first_name,
  ua.last_name       AS performed_by_last_name,
  al.new_values      AS audit_payload,
  al.created_at      AS audit_created_at
FROM reward_redemptions rr
JOIN rewards r ON r.id = rr.reward_id
JOIN clients c ON c.id = rr.client_id
JOIN users   u ON u.id = c.user_id
JOIN tenants t ON t.id = rr.tenant_id
LEFT JOIN audit_log al
  ON al.entity_type = 'RewardRedemption'
  AND al.entity_id  = rr.id
LEFT JOIN users ua ON ua.id = al.user_id
WHERE u.email = 'sergioibarra275@gmail.com'
  AND t.slug  = 'demo-salon'
  AND r.discount_mode  = 'PERCENTAGE'
  AND r.discount_amount = 15
ORDER BY rr.created_at DESC;
