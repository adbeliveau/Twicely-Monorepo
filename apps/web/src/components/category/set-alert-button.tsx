'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { saveCategoryAlertAction } from '@/lib/actions/category-alerts';
import { cn } from '@twicely/utils';

interface SetAlertButtonProps {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  isLoggedIn: boolean;
  autoSetAlert?: boolean;
  disabled?: boolean;
}

export function SetAlertButton({
  categoryId,
  categoryName,
  categorySlug,
  isLoggedIn,
  autoSetAlert = false,
  disabled = false,
}: SetAlertButtonProps) {
  const router = useRouter();
  const [alertSet, setAlertSet] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Auto-set alert on mount if redirected back from login
  useEffect(() => {
    if (autoSetAlert && isLoggedIn && !alertSet) {
      handleSetAlert();
      // Clean URL
      router.replace(`/c/${categorySlug}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetAlert = () => {
    if (alertSet) return; // Already set, don't allow duplicate clicks

    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=/c/${categorySlug}?action=alert`);
      return;
    }

    setAlertSet(true); // Optimistic

    startTransition(async () => {
      const result = await saveCategoryAlertAction({
        categoryId,
        categoryName,
      });
      if (!result.success) {
        setAlertSet(false); // Revert
      } else {
        setShowConfirmation(true);
        setTimeout(() => setShowConfirmation(false), 2000);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSetAlert}
      disabled={disabled || isPending || alertSet}
      className={cn(alertSet && 'text-primary border-primary')}
    >
      {alertSet ? (
        <>
          <Bell className="h-4 w-4 mr-1 fill-current" />
          Alert Set
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4 mr-1" />
          Set Alert
        </>
      )}
      {showConfirmation && (
        <Check className="ml-1 h-4 w-4 text-green-600" />
      )}
    </Button>
  );
}
