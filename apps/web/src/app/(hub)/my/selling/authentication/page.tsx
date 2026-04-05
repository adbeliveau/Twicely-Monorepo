import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import { getAuthenticationRequestsForSeller } from '@/lib/queries/authentication';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AUTH_SETTINGS_KEYS } from '@/lib/authentication/constants';
import { RequestAiAuthForm } from '@/components/hub/request-ai-auth-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Authentication | Twicely',
  robots: 'noindex',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  AI_PENDING: { label: 'AI Pending', variant: 'secondary' },
  AI_AUTHENTICATED: { label: 'Authenticated', variant: 'default' },
  AI_INCONCLUSIVE: { label: 'Inconclusive', variant: 'outline' },
  AI_COUNTERFEIT: { label: 'Counterfeit Detected', variant: 'destructive' },
  EXPERT_PENDING: { label: 'Expert Pending', variant: 'secondary' },
  EXPERT_AUTHENTICATED: { label: 'Expert Authenticated', variant: 'default' },
};

export default async function AuthenticationPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/authentication');
  }

  const [aiEnabled, { requests }] = await Promise.all([
    getPlatformSetting<boolean>(AUTH_SETTINGS_KEYS.AI_ENABLED, false),
    getAuthenticationRequestsForSeller(session.userId, { limit: 50 }),
  ]);

  const pendingRequests = requests.filter((r) => r.status === 'AI_PENDING' || r.status === 'EXPERT_PENDING');
  const completedRequests = requests.filter((r) => r.status !== 'AI_PENDING' && r.status !== 'EXPERT_PENDING');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/my/selling/listings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Authentication</h1>
          <p className="text-muted-foreground">
            Request AI or expert authentication for your luxury items.
          </p>
        </div>
      </div>

      {/* Request AI Auth Form */}
      {aiEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <CardTitle>Request AI Authentication</CardTitle>
            </div>
            <CardDescription>
              Upload at least 3 photos of your item to verify its authenticity using AI.
              Results are typically returned within minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestAiAuthForm />
          </CardContent>
        </Card>
      )}

      {!aiEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>AI Authentication</CardTitle>
            <CardDescription>
              AI authentication is not currently available. Contact support for expert authentication options.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <CardTitle>Pending ({pendingRequests.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Request #{req.id.slice(-8)}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <Badge variant={STATUS_CONFIG[req.status]?.variant ?? 'outline'}>
                    {STATUS_CONFIG[req.status]?.label ?? req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Requests */}
      {completedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History ({completedRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {completedRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {req.certificateNumber ? `Certificate #${req.certificateNumber}` : `Request #${req.id.slice(-8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.completedAt ? new Date(req.completedAt).toLocaleDateString() : 'Processing'}
                      {req.tier === 'AI' ? ' — AI' : ' — Expert'}
                    </p>
                  </div>
                  <Badge variant={STATUS_CONFIG[req.status]?.variant ?? 'outline'}>
                    {STATUS_CONFIG[req.status]?.label ?? req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {requests.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No authentication requests yet. Use the form above to authenticate your first item.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
