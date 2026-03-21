/**
 * StaffAvatar — Circle avatar showing first initial of the staff member's name.
 * Used in the staff table and staff detail pages.
 */

interface StaffAvatarProps {
  displayName: string;
  /** Size variant: sm = 32px, md = 40px, lg = 64px */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-20 w-20 text-2xl',
};

export function StaffAvatar({ displayName, size = 'md', className = '' }: StaffAvatarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  return (
    <div
      aria-label={`Avatar for ${displayName}`}
      className={[
        'flex flex-shrink-0 items-center justify-center rounded-full',
        'bg-gray-200 font-semibold text-gray-600',
        sizeClass,
        className,
      ].join(' ')}
    >
      {initial}
    </div>
  );
}
