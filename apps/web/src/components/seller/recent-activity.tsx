import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { ShoppingCart, Eye, Star } from 'lucide-react';
import type { SellerRecentActivity } from '@/lib/queries/seller-dashboard';

interface RecentActivityProps {
  activities: SellerRecentActivity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent activity. Your activity will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <ActivityItem key={`${activity.type}-${index}`} activity={activity} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ActivityItemProps {
  activity: SellerRecentActivity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const relativeTime = getRelativeTime(activity.timestamp);

  const iconClass = "h-4 w-4";
  let icon: React.ReactNode;

  switch (activity.type) {
    case 'order':
    case 'sale':
      icon = <ShoppingCart className={iconClass} />;
      break;
    case 'watcher':
      icon = <Star className={iconClass} />;
      break;
    case 'views':
      icon = <Eye className={iconClass} />;
      break;
    default:
      icon = <ShoppingCart className={iconClass} />;
  }

  const content = (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm">{activity.description}</p>
        <p className="text-xs text-muted-foreground">{relativeTime}</p>
      </div>
    </div>
  );

  if (activity.linkUrl) {
    return (
      <Link href={activity.linkUrl} className="block hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors">
        {content}
      </Link>
    );
  }

  return <div className="p-2 -m-2">{content}</div>;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}
