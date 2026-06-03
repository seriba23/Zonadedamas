-- Adds customizable confetti style (icon slug) and color palette (json array
-- of hex strings) per tenant. Null on both means the existing teal-rectangles
-- default. Used by the marketplace booking-success and the admin wizard.
ALTER TABLE `tenants`
  ADD COLUMN `confetti_style` VARCHAR(40) NULL,
  ADD COLUMN `confetti_colors` JSON NULL;
