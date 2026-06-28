'use client';

// ============================================================
// Configuración del ANTICIPO de citas en el portal del freelancer.
// Reusa <DepositSettingsContent/> (mismo componente que el dashboard del admin).
// ============================================================

import { DepositSettingsContent } from '@/components/settings/deposit-settings-content';

export default function EmployeeDepositPage() {
  return (
    <div className="h-full overflow-y-auto">
      <DepositSettingsContent />
    </div>
  );
}
