'use client';

interface TypingIndicatorProps {
  visible: boolean;
}

export function TypingIndicator({ visible }: TypingIndicatorProps) {
  if (!visible) return null;
  return (
    <p className="text-xs italic text-gray-400 px-1">Typing...</p>
  );
}
