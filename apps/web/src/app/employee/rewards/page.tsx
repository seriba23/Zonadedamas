'use client';

import { RewardsContent } from '@/app/(dashboard)/rewards/rewards-content';

/**
 * /employee/rewards
 *
 * Cupones / recompensas desde el portal empleado. Para freelancer es su
 * unica via para crear cupones que puedan canjear sus clientes (no entra
 * al admin).
 *
 * Reusa RewardsContent del admin: mismo CRUD, mismos endpoints, mismos
 * permisos (rewards.create/read/update/delete) que el rol Owner del
 * freelancer tiene por default.
 */
export default function EmployeeRewardsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <RewardsContent />
      </div>
    </div>
  );
}
