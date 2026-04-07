import {
  Package,
  RefreshCw,
  CreditCard,
  Shield,
  Store,
  Link2,
  User,
  FileText,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  RefreshCw,
  CreditCard,
  Shield,
  Store,
  Link2,
  User,
  FileText,
  HelpCircle,
};

export function KbCategoryIcon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = (name && ICON_MAP[name]) || HelpCircle;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
