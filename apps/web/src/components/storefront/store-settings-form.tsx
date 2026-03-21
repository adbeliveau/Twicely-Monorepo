'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { AccentColorPicker } from './accent-color-picker';
import { FeaturedListingPicker } from './featured-listing-picker';
import { StoreCategoriesEditor } from './store-categories-editor';
import { StorePreview } from './store-preview';
import { TierGateCTA } from './tier-gate-cta';
import { updateStorefrontSettings, updateStoreCategories } from '@/lib/actions/storefront';
import { canUseFeature } from '@twicely/utils/tier-gates';

interface Category { name: string; slug: string; sortOrder: number }

interface StoreSettingsFormProps {
  storefront: {
    storeName: string | null; storeSlug: string | null; storeDescription: string | null;
    returnPolicy: string | null; bannerUrl: string | null; logoUrl: string | null;
    accentColor: string | null; announcement: string | null; aboutHtml: string | null;
    socialLinks: Record<string, string>; featuredListingIds: string[];
    isStorePublished: boolean; defaultStoreView: string;
  };
  categories: Category[];
  availableListings: { id: string; title: string; imageUrl: string | null; priceCents: number }[];
  storeTier: string;
}

export function StoreSettingsForm({ storefront, categories: initialCategories, availableListings, storeTier }: StoreSettingsFormProps) {
  const [storeName, setStoreName] = useState(storefront.storeName ?? '');
  const [storeSlug, setStoreSlug] = useState(storefront.storeSlug ?? '');
  const [storeDescription, setStoreDescription] = useState(storefront.storeDescription ?? '');
  const [bannerUrl, setBannerUrl] = useState(storefront.bannerUrl ?? '');
  const [logoUrl, setLogoUrl] = useState(storefront.logoUrl ?? '');
  const [accentColor, setAccentColor] = useState(storefront.accentColor);
  const [announcement, setAnnouncement] = useState(storefront.announcement ?? '');
  const [aboutHtml, setAboutHtml] = useState(storefront.aboutHtml ?? '');
  const [returnPolicy, setReturnPolicy] = useState(storefront.returnPolicy ?? '');
  const [featuredListingIds, setFeaturedListingIds] = useState(storefront.featuredListingIds);
  const [socialLinks, setSocialLinks] = useState({
    instagram: storefront.socialLinks.instagram ?? '', youtube: storefront.socialLinks.youtube ?? '',
    tiktok: storefront.socialLinks.tiktok ?? '', twitter: storefront.socialLinks.twitter ?? '',
    website: storefront.socialLinks.website ?? '',
  });
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [defaultStoreView, setDefaultStoreView] = useState<'grid' | 'list'>(storefront.defaultStoreView === 'list' ? 'list' : 'grid');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const canAnnouncement = canUseFeature(storeTier, 'announcement');
  const canSocialLinks = canUseFeature(storeTier, 'socialLinks');
  const canCategories = canUseFeature(storeTier, 'customCategories');

  const handleSave = async () => {
    setSaving(true); setSaveStatus('idle');
    const cleanedSocial: Record<string, string> = {};
    Object.entries(socialLinks).forEach(([k, v]) => { if (v) cleanedSocial[k] = v; });
    const result = await updateStorefrontSettings({
      storeName: storeName || undefined, storeSlug: storeSlug || undefined,
      storeDescription: storeDescription || undefined, returnPolicy: returnPolicy || undefined,
      bannerUrl: bannerUrl || null, logoUrl: logoUrl || null, accentColor: accentColor || null,
      announcement: canAnnouncement ? (announcement || null) : undefined,
      aboutHtml: aboutHtml || null,
      socialLinks: canSocialLinks ? cleanedSocial : undefined, featuredListingIds, defaultStoreView,
    });
    if (canCategories) { const validCats = categories.filter(c => c.name && c.slug); await updateStoreCategories(validCats); }
    setSaving(false);
    if (result.success) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
    else { setSaveStatus('error'); setErrorMsg(result.error ?? 'Save failed'); }
  };

  const updateSocialLink = (key: string, value: string) => setSocialLinks(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="lg:hidden flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowMobilePreview(!showMobilePreview)}>
          {showMobilePreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
      </div>
      {showMobilePreview && (
        <div className="lg:hidden">
          <StorePreview storeName={storeName} bannerUrl={bannerUrl || null} logoUrl={logoUrl || null}
            accentColor={accentColor} announcement={announcement || null} aboutHtml={aboutHtml || null} viewport="mobile" />
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          {/* Identity */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Identity</h2>
            <div className="space-y-2"><Label htmlFor="storeName">Store Name</Label>
              <Input id="storeName" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="My Store" maxLength={50} /></div>
            <div className="space-y-2"><Label htmlFor="storeSlug">Store URL</Label>
              <div className="flex"><span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">twicely.co/st/</span>
                <Input id="storeSlug" value={storeSlug} onChange={e => setStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="rounded-l-none" placeholder="my-store" maxLength={30} /></div></div>
            <div className="space-y-2"><Label htmlFor="storeDescription">Store Description</Label>
              <Textarea id="storeDescription" value={storeDescription} onChange={e => setStoreDescription(e.target.value)} placeholder="About your store..." rows={3} /></div>
          </section>
          {/* Branding */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Branding</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="bannerUrl">Banner URL</Label><Input id="bannerUrl" value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." /></div>
              <div className="space-y-2"><Label htmlFor="logoUrl">Logo URL</Label><Input id="logoUrl" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
            </div>
            {/* TODO: Replace with R2 file upload component (Phase E) */}
            <div className="space-y-2"><Label>Accent Color</Label><AccentColorPicker value={accentColor} onChange={setAccentColor} /></div>
          </section>
          {/* Content */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Content</h2>
            <div className="relative">
              <div className="space-y-2"><Label htmlFor="announcement">Announcement Bar</Label>
                <Input id="announcement" value={announcement} onChange={e => setAnnouncement(e.target.value)} placeholder="Free shipping over $50!" maxLength={200} disabled={!canAnnouncement} />
                <p className="text-xs text-muted-foreground">{announcement.length}/200</p></div>
              {!canAnnouncement && <TierGateCTA feature="Announcement Bar" requiredTier="STARTER" currentTier={storeTier} />}
            </div>
            <div className="space-y-2"><Label htmlFor="aboutHtml">About Section</Label>
              <Textarea id="aboutHtml" value={aboutHtml} onChange={e => setAboutHtml(e.target.value)} placeholder="Tell your story..." rows={4} maxLength={2000} />
              <p className="text-xs text-muted-foreground">{aboutHtml.length}/2000</p></div>
            <div className="space-y-2"><Label htmlFor="returnPolicy">Return Policy</Label>
              <Textarea id="returnPolicy" value={returnPolicy} onChange={e => setReturnPolicy(e.target.value)} placeholder="Your return policy..." rows={3} /></div>
          </section>
          {/* Featured */}
          <section className="space-y-4"><h2 className="text-lg font-semibold">Featured Listings</h2>
            <FeaturedListingPicker selectedIds={featuredListingIds} onChange={setFeaturedListingIds} availableListings={availableListings} /></section>
          {/* Social Links */}
          <section className="space-y-4 relative">
            <h2 className="text-lg font-semibold">Social Links</h2>
            <div className="space-y-3">{[
              { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore' },
              { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstore' },
              { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourstore' },
              { key: 'twitter', label: 'Twitter/X', placeholder: 'https://x.com/yourstore' },
              { key: 'website', label: 'Website', placeholder: 'https://yourstore.com' },
            ].map(s => (<div key={s.key} className="space-y-1"><Label htmlFor={s.key}>{s.label}</Label>
              <Input id={s.key} value={socialLinks[s.key as keyof typeof socialLinks]} onChange={e => updateSocialLink(s.key, e.target.value)} placeholder={s.placeholder} disabled={!canSocialLinks} /></div>))}</div>
            {!canSocialLinks && <TierGateCTA feature="Social Links" requiredTier="STARTER" currentTier={storeTier} />}
          </section>
          {/* Categories */}
          <section className="space-y-4 relative">
            <h2 className="text-lg font-semibold">Store Categories</h2>
            <StoreCategoriesEditor categories={categories} onChange={setCategories} disabled={!canCategories} />
            {!canCategories && <TierGateCTA feature="Custom Categories" requiredTier="PRO" currentTier={storeTier} />}
          </section>
          {/* Display Preferences */}
          <section className="space-y-4"><h2 className="text-lg font-semibold">Display Preferences</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="view" checked={defaultStoreView === 'grid'} onChange={() => setDefaultStoreView('grid')} /><span>Grid</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="view" checked={defaultStoreView === 'list'} onChange={() => setDefaultStoreView('list')} /><span>List</span></label>
            </div></section>
          {/* Actions */}
          <div className="sticky bottom-0 bg-background border-t py-3 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}</Button>
            {storeSlug && storefront.isStorePublished ? (
              <Button variant="ghost" asChild><Link href={`/st/${storeSlug}`} target="_blank">View Store <ExternalLink className="ml-1 h-3 w-3" /></Link></Button>
            ) : <Button variant="ghost" disabled className="text-muted-foreground">View Store</Button>}
            {saveStatus === 'error' && <span className="text-sm text-destructive">{errorMsg}</span>}
          </div>
        </div>
        {/* Preview */}
        <div className="hidden lg:block"><div className="sticky top-4 space-y-3">
          <div className="flex gap-2">
            <Button variant={previewViewport === 'desktop' ? 'default' : 'outline'} size="sm" onClick={() => setPreviewViewport('desktop')}><Monitor className="h-4 w-4 mr-1" /> Desktop</Button>
            <Button variant={previewViewport === 'mobile' ? 'default' : 'outline'} size="sm" onClick={() => setPreviewViewport('mobile')}><Smartphone className="h-4 w-4 mr-1" /> Mobile</Button>
          </div>
          <StorePreview storeName={storeName} bannerUrl={bannerUrl || null} logoUrl={logoUrl || null} accentColor={accentColor} announcement={announcement || null} aboutHtml={aboutHtml || null} viewport={previewViewport} />
        </div></div>
      </div>
    </div>
  );
}
