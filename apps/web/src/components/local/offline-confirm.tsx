'use client';

import { useState, useEffect, useTransition } from 'react';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import {
  confirmReceiptOfflineAction,
  confirmReceiptOfflineDualCodeAction,
} from '@/lib/actions/local-transaction';
import { storeTokens, getStoredTokens, clearStoredTokens } from '@twicely/commerce/local-token-store';
import { verifyTokenClient } from '@twicely/commerce/local-token-client';
import type { PreloadedTokenData } from '@/lib/types/local-token';

interface OfflineConfirmProps {
  localTransactionId: string;
  /** Grace period in hours for offline confirmations (default: 2) */
  graceHours?: number;
  onSuccess?: () => void;
}

/**
 * Offline receipt confirmation for local pickup.
 * Dual-token mode: both parties scan each other, submit combined payload when online.
 * Dual-code fallback: both enter each other's 6-digit codes.
 */
export function OfflineConfirm({ localTransactionId, graceHours = 2, onSuccess }: OfflineConfirmProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [storedData, setStoredData] = useState<PreloadedTokenData | null>(null);
  const [buyerCodeInput, setBuyerCodeInput] = useState('');
  const [sellerCodeInput, setSellerCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offlineVerified, setOfflineVerified] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Initialize online/offline state safely (navigator may not be available during SSR)
  useEffect(() => {
    setIsOffline(!navigator.onLine);
  }, []);

  // Load preloaded tokens from IndexedDB
  useEffect(() => {
    getStoredTokens(localTransactionId).then((data) => {
      if (data) setStoredData(data);
    }).catch(() => { /* IndexedDB unavailable */ });
  }, [localTransactionId]);

  // Listen for online/offline events
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function handleOfflineVerify() {
    if (!storedData) return;
    // Verify seller token on-device using public key
    const result = verifyTokenClient(storedData.sellerToken);
    if (!result.valid) {
      setError(result.error ?? 'Seller token verification failed');
      return;
    }
    setOfflineVerified(true);
    setError(null);
  }

  function syncDualTokens() {
    if (!storedData) return;
    const offlineTimestamp = new Date().toISOString();
    startTransition(async () => {
      const result = await confirmReceiptOfflineAction({
        localTransactionId,
        sellerToken: storedData.sellerToken,
        buyerToken: storedData.buyerToken,
        offlineTimestamp,
      });
      if (result.success) {
        await clearStoredTokens(localTransactionId);
        onSuccess?.();
      } else {
        setError(result.error ?? 'Sync failed. Please try again.');
      }
    });
  }

  function handleDualCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sellerCodeInput.length !== 6 || buyerCodeInput.length !== 6) {
      setError('Please enter both 6-digit codes');
      return;
    }
    const offlineTimestamp = new Date().toISOString();

    if (isOffline) {
      // Store for sync when online
      const pending: PreloadedTokenData = {
        sellerToken: '',
        buyerToken: '',
        sellerOfflineCode: sellerCodeInput,
        buyerOfflineCode: buyerCodeInput,
        transactionId: localTransactionId,
        amountCents: 0,
        expiresAt: '',
        storedAt: offlineTimestamp,
      };
      storeTokens(localTransactionId, pending).catch(() => { /* ignore */ });
      setStoredData(pending);
      setError(null);
      return;
    }

    startTransition(async () => {
      const result = await confirmReceiptOfflineDualCodeAction({
        localTransactionId,
        sellerOfflineCode: sellerCodeInput,
        buyerOfflineCode: buyerCodeInput,
        offlineTimestamp,
      });
      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error ?? 'Invalid codes. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {isOffline && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            You&apos;re offline. Codes expire in {graceHours} hour{graceHours !== 1 ? 's' : ''}.
          </span>
        </div>
      )}

      {/* Offline device verification using preloaded tokens */}
      {storedData?.sellerToken && !offlineVerified && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Verify seller&apos;s token offline</p>
          <Button variant="outline" onClick={handleOfflineVerify}>
            Verify on Device
          </Button>
        </div>
      )}

      {offlineVerified && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            Transaction verified cryptographically. Will sync automatically when connected.
          </span>
        </div>
      )}

      {/* Sync button when back online */}
      {storedData && !isOffline && (
        <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          <span>Offline confirmation saved — syncing now.</span>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={syncDualTokens}
            className="ml-2 gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
          </Button>
        </div>
      )}

      {/* Dual-code fallback for when tokens are not preloaded */}
      {!storedData?.sellerToken && (
        <form onSubmit={handleDualCodeSubmit} className="space-y-3">
          <p className="text-sm font-medium">Enter both 6-digit codes</p>
          <div className="space-y-1">
            <label htmlFor="seller-code-offline" className="text-xs text-muted-foreground">
              Seller&apos;s code
            </label>
            <Input
              id="seller-code-offline"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={sellerCodeInput}
              onChange={(e) => {
                setSellerCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              className="font-mono text-center text-lg tracking-widest w-40"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="buyer-code-offline" className="text-xs text-muted-foreground">
              Your code (from your QR screen)
            </label>
            <Input
              id="buyer-code-offline"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={buyerCodeInput}
              onChange={(e) => {
                setBuyerCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              className="font-mono text-center text-lg tracking-widest w-40"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            disabled={(sellerCodeInput.length !== 6 || buyerCodeInput.length !== 6) || isPending}
          >
            {isPending ? 'Confirming…' : isOffline ? 'Save for Sync' : 'Confirm Receipt'}
          </Button>
        </form>
      )}

      {error && !storedData?.sellerToken && null /* error shown inside form */}
      {error && storedData?.sellerToken && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
