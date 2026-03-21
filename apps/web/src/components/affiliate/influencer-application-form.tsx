'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Star } from 'lucide-react';
import { applyForInfluencer } from '@/lib/actions/affiliate-influencer';

export function InfluencerApplicationForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [applicationNote, setApplicationNote] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [blog, setBlog] = useState('');
  const [audienceSize, setAudienceSize] = useState('');

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const socialLinks = {
        instagram: instagram.trim() || undefined,
        youtube: youtube.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        blog: blog.trim() || undefined,
      };

      const hasSocialLinks = Object.values(socialLinks).some(Boolean);
      const parsedAudienceSize = audienceSize.trim()
        ? parseInt(audienceSize.trim(), 10)
        : undefined;

      const result = await applyForInfluencer({
        applicationNote: applicationNote.trim(),
        socialLinks: hasSocialLinks ? socialLinks : undefined,
        audienceSize: parsedAudienceSize,
      });

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error ?? 'Something went wrong');
      }
    });
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Submitted</CardTitle>
          <CardDescription>
            Your influencer application has been submitted. We will review it and notify you within
            a few business days.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Apply for the Influencer Program
        </CardTitle>
        <CardDescription>
          Earn 20–30% commission with a 60-day attribution window. Influencer partners also get
          multiple promo codes, custom landing pages, and dedicated support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="applicationNote">Tell us about yourself and your audience</Label>
          <Textarea
            id="applicationNote"
            value={applicationNote}
            onChange={(e) => setApplicationNote(e.target.value)}
            placeholder="Describe your platform, audience, and how you plan to promote Twicely..."
            className="mt-1"
            rows={4}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Minimum 20 characters. Include your niche, content type, and audience demographics.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Social Links (optional)</Label>
          <div>
            <Label htmlFor="instagram" className="text-xs text-muted-foreground">Instagram</Label>
            <Input
              id="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourprofile"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="youtube" className="text-xs text-muted-foreground">YouTube</Label>
            <Input
              id="youtube"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="tiktok" className="text-xs text-muted-foreground">TikTok</Label>
            <Input
              id="tiktok"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://tiktok.com/@yourprofile"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="blog" className="text-xs text-muted-foreground">Blog / Website</Label>
            <Input
              id="blog"
              value={blog}
              onChange={(e) => setBlog(e.target.value)}
              placeholder="https://yourblog.com"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="audienceSize">Total audience size (optional)</Label>
          <Input
            id="audienceSize"
            type="number"
            min={0}
            value={audienceSize}
            onChange={(e) => setAudienceSize(e.target.value)}
            placeholder="e.g. 50000"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Combined followers across all platforms.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
          {isPending ? 'Submitting...' : 'Submit Application'}
        </Button>
      </CardContent>
    </Card>
  );
}
