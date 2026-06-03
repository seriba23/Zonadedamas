-- Replaces single-style with an array (up to 3 shapes) so the owner can mix
-- different confetti figures. The legacy `confetti_style` column stays for
-- backwards compatibility — used as fallback when `confetti_styles` is null.
ALTER TABLE `tenants` ADD COLUMN `confetti_styles` JSON NULL;
