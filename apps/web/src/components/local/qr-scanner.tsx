'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@twicely/ui/button';
import { confirmReceiptAction } from '@/lib/actions/local-transaction';

interface QrScannerProps {
  localTransactionId: string;
  onSuccess?: () => void;
}

/**
 * Camera-based QR code scanner for buyer to confirm local pickup receipt.
 * Scans the seller's Ed25519 token QR code.
 * On successful scan: calls confirmReceiptAction with the sellerToken.
 */
export function QrScanner({ localTransactionId, onSuccess }: QrScannerProps) {
  const scannerDivId = 'qr-scanner-region';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasConfirmedRef = useRef(false);

  function handleScanSuccess(decodedText: string) {
    startTransition(async () => {
      const result = await confirmReceiptAction({
        localTransactionId,
        sellerToken: decodedText,
      });

      if (!result.success) {
        hasConfirmedRef.current = false;
        setError(result.error ?? 'Invalid QR code. Please try again.');
      } else {
        onSuccess?.();
      }
    });
  }

  // Stable ref so the scanner callback always calls the latest handler without restarting
  const handleScanSuccessRef = useRef(handleScanSuccess);
  useEffect(() => { handleScanSuccessRef.current = handleScanSuccess; });

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    async function startScanner() {
      try {
        const { Html5Qrcode: QrLib } = await import('html5-qrcode');
        scanner = new QrLib(scannerDivId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decodedText: string) => {
            if (hasConfirmedRef.current) return;
            hasConfirmedRef.current = true;
            handleScanSuccessRef.current(decodedText);
          },
          () => {
            // Per-frame error — not a fatal error, scanner continues
          },
        );

        setIsScanning(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
          setCameraDenied(true);
        } else {
          setError('Unable to start camera. Please use manual code entry.');
        }
      }
    }

    void startScanner();

    return () => {
      if (scanner !== null) {
        try {
          scanner.clear();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  if (cameraDenied) {
    return (
      <div className="space-y-3 text-center py-4">
        <p className="text-sm text-destructive">
          Camera access was denied. Please allow camera access in your browser settings.
        </p>
        <p className="text-sm text-muted-foreground">
          <a href="#manual-entry" className="underline">
            {"Can't scan? Enter the code manually"}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        Point your camera at the seller&apos;s QR code
      </p>

      <div
        id={scannerDivId}
        className="w-full rounded-lg overflow-hidden border bg-muted/20"
        style={{ minHeight: '260px' }}
      />

      {!isScanning && !error && (
        <p className="text-xs text-muted-foreground text-center">Starting camera…</p>
      )}

      {isPending && (
        <p className="text-xs text-muted-foreground text-center">Confirming…</p>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <div className="text-center">
        <a href="#manual-entry" className="text-sm text-muted-foreground underline">
          {"Can't scan? Enter the code manually"}
        </a>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          if (scannerRef.current) {
            try { scannerRef.current.clear(); } catch { /* ignore */ }
          }
          setIsScanning(false);
          setError(null);
          hasConfirmedRef.current = false;
        }}
        disabled={isPending}
      >
        Stop Scanner
      </Button>
    </div>
  );
}
