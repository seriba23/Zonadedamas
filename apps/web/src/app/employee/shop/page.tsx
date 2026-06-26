'use client';

// ============================================================
// Tienda del portal del EMPLEADO/FREELANCER.
// Reusa <ShopSettingsContent/> del dashboard (autocontenido: gestiona
// shopEnabled, opciones de entrega y métodos de pago vía /api/tenants/
// shop-settings). El freelancer ya queda marketplace-listed al registrarse,
// así que activar la tienda aquí basta para que sus productos aparezcan en
// su perfil público del marketplace.
// ============================================================

import { ShopSettingsContent } from '@/app/(dashboard)/settings/shop/shop-content';

export default function EmployeeShopPage() {
  return (
    <div className="h-full overflow-y-auto">
      <ShopSettingsContent />
    </div>
  );
}
