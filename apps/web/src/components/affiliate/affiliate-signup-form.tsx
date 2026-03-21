'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Copy, Check, Users } from 'lucide-react';
import { joinAffiliateProgram } from '@/lib/actions/affiliate';

interface AffiliateSignupFormProps {
  defaultCode: string;
}

export function AffiliateSignupForm({ defaultCode }: AffiliateSignupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState(defaultCode);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await joinAffiliateProgram(
        codeInput.trim() ? { referralCode: codeInput.trim() } : {},
      );
      if (result.success) {
        setReferralCode(result.referralCode ?? null);
      } else {
        setError(result.error ?? 'Something went wrong');
      }
    });
  }

  async function copyLink() {
    if (!referralCode) return;
    await navigator.clipboard.writeText(`twicely.co/ref/${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (referralCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Welcome to the Affiliate Program
          </CardTitle>
          <CardDescription>
            You are now a Twicely community affiliate. Share your link to earn commissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Your referral link</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
                twicely.co/ref/{referralCode}
              </code>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href="/my/selling/affiliate">Go to Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Join the Twicely Affiliate Program
        </CardTitle>
        <CardDescription>
          Earn 15% commission on subscription revenue from users you refer, for 12 months.
          Commissions apply to Store, Crosslister, Finance, and Automation subscriptions.
          Transaction fees, boosting, and overage packs do not earn commissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="referralCode">Referral Code</Label>
          <Input
            id="referralCode"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="YOUR-CODE"
            className="mt-1 uppercase"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            3-30 characters. Letters, numbers, hyphens, underscores only.
          </p>
        </div>
        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
          {isPending ? 'Joining...' : 'Join Program'}
        </Button>
      </CardContent>
    </Card>
  );
}
