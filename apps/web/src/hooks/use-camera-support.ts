'use client';

import { useState, useEffect } from 'react';

interface CameraSupportResult {
  hasCamera: boolean;
  hasMediaRecorder: boolean;
  isSupported: boolean;
  isLoading: boolean;
}

export function useCameraSupport(): CameraSupportResult {
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMediaRecorder, setHasMediaRecorder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect(): Promise<void> {
      // SSR guard
      if (typeof navigator === 'undefined') {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const hasGetUserMedia =
        typeof navigator.mediaDevices?.getUserMedia === 'function';

      const hasRecorder = typeof MediaRecorder !== 'undefined';

      if (!hasGetUserMedia || !hasRecorder) {
        if (!cancelled) {
          setHasCamera(false);
          setHasMediaRecorder(hasRecorder);
          setIsLoading(false);
        }
        return;
      }

      let foundVideoInput = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        foundVideoInput = devices.some((d) => d.kind === 'videoinput');
      } catch {
        foundVideoInput = false;
      }

      if (!cancelled) {
        setHasCamera(foundVideoInput);
        setHasMediaRecorder(true);
        setIsLoading(false);
      }
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    hasCamera,
    hasMediaRecorder,
    isSupported: hasCamera && hasMediaRecorder,
    isLoading,
  };
}
