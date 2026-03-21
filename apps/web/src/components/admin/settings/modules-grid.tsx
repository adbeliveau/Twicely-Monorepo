'use client';

import { useState } from 'react';
import { ModuleCard } from './module-card';
import { UninstallModuleDialog } from './uninstall-module-dialog';
import type { ModuleRow } from '@/lib/queries/admin-modules';

interface ModulesGridProps {
  modules: ModuleRow[];
  canEdit: boolean;
}

export function ModulesGrid({ modules, canEdit }: ModulesGridProps) {
  const [uninstallTarget, setUninstallTarget] = useState<ModuleRow | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.id}
            moduleId={mod.moduleId}
            label={mod.label}
            description={mod.description}
            state={mod.state}
            version={mod.version}
            configPath={mod.configPath}
            canEdit={canEdit}
            onUninstall={() => setUninstallTarget(mod)}
          />
        ))}
      </div>
      {uninstallTarget && (
        <UninstallModuleDialog
          moduleId={uninstallTarget.moduleId}
          label={uninstallTarget.label}
          open={!!uninstallTarget}
          onClose={() => setUninstallTarget(null)}
        />
      )}
    </>
  );
}
