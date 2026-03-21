'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  /** Ed25519-signed token — encoded into the QR image */
  token: string;
  /** 6-digit numeric fallback shown below the QR image */
  offlineCode: string;
  /** Viewer role — shown in label */
  role: 'BUYER' | 'SELLER';
}

/**
 * Renders a QR code showing the Ed25519 token for one party's role.
 * The seller shows their sellerToken; the buyer shows their buyerToken.
 * Falls back to the 6-digit offline code when scanning isn't possible.
 */
export function QrCodeDisplay({ token, offlineCode, role }: QrCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, token, {
      width: 220,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).catch(() => {
      // Canvas render failed — the offline code remains visible
    });
  }, [token]);

  const label = role === 'SELLER' ? 'Your QR code (seller)' : 'Your QR code (buyer)';

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <canvas
        ref={canvasRef}
        aria-label={label}
        className="rounded-lg border"
      />
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">
          {"Can't scan? Use this code:"}
        </p>
        <p
          className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground"
          aria-label={`Offline code ${offlineCode}`}
        >
          {offlineCode}
        </p>
      </div>
    </div>
  );
}
