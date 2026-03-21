'use client';

import { useTransition, useState } from 'react';
import { toggleNotificationTemplateAction } from '@/lib/actions/admin-notifications';

interface NotificationTemplateToggleProps {
  templateId: string;
  isActive: boolean;
}

export function NotificationTemplateToggle({
  templateId,
  isActive,
}: NotificationTemplateToggleProps) {
  const [pending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(isActive);

  function handleClick() {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleNotificationTemplateAction({ templateId, isActive: next });
      if (result && 'error' in result) {
        setOptimisticActive(optimisticActive);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
      title={optimisticActive ? 'Deactivate template' : 'Activate template'}
    >
      {optimisticActive ? 'Deactivate' : 'Activate'}
    </button>
  );
}
