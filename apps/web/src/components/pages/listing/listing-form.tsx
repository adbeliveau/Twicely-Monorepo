'use client';

import { useState, useCallback } from 'react';
import { Input } from '@twicely/ui/input';
import { Textarea } from '@twicely/ui/textarea';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { ListingPhotosCard } from './listing-photos-card';
import { ListingVideoCard } from './listing-video-card';
import { ListingFormActions } from './listing-form-actions';
import { CategoryPicker } from './category-picker';
import { ConditionSelect } from './condition-select';
import { TagsInput } from './tags-input';
import { PriceInput } from './price-input';
import { OffersSection } from './offers-section';
import { ShippingSection } from './shipping-section';
import { FulfillmentSection } from './fulfillment-section';
import { type ListingFormData, type ListingFormErrors, type ListingCondition,
  validateListingForm, hasErrors, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_QUANTITY,
} from '@/types/listing-form';
import type { UploadedImage } from '@/types/upload';
import type { CategorySearchResult } from '@/lib/queries/category-search';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';
import { applyAiSuggestions } from './listing-form-ai-handler';

interface ListingFormProps {
  initialData?: Partial<ListingFormData>;
  onSubmit: (data: ListingFormData, mode: 'ACTIVE' | 'DRAFT') => Promise<void>;
  isSubmitting?: boolean;
  aiAutofillRemaining?: number;
}

const defaultFormData: ListingFormData = {
  title: '', description: '', category: null, condition: null, brand: '',
  tags: [], images: [], quantity: 1, priceCents: 0, originalPriceCents: null,
  cogsCents: null, allowOffers: false, autoAcceptOfferCents: null,
  autoDeclineOfferCents: null, freeShipping: false, shippingCents: 0,
  weightOz: null, lengthIn: null, widthIn: null, heightIn: null,
  fulfillmentType: 'SHIP_ONLY', localPickupRadiusMiles: null, localHandlingFlags: [],
  videoUrl: null, videoThumbUrl: null, videoDurationSeconds: null,
};

export function ListingForm({ initialData, onSubmit, isSubmitting, aiAutofillRemaining }: ListingFormProps) {
  const [formData, setFormData] = useState<ListingFormData>({
    ...defaultFormData,
    ...initialData,
  });
  const [errors, setErrors] = useState<ListingFormErrors>({});
  const [aiSuggestionApplied, setAiSuggestionApplied] = useState(false);
  const [aiPriceHint, setAiPriceHint] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof ListingFormData>(
    field: K,
    value: ListingFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleAiSuggestions = useCallback((s: AiAutofillSuggestions) => {
    applyAiSuggestions(formData, s, updateField, setAiPriceHint);
    setAiSuggestionApplied(true);
  }, [formData, updateField]);

  const handleSubmit = useCallback(async (mode: 'ACTIVE' | 'DRAFT') => {
    const validationErrors = validateListingForm(formData, mode);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;
    await onSubmit(formData, mode);
  }, [formData, onSubmit]);

  return (
    <div className="space-y-8">
      <ListingPhotosCard
        images={formData.images}
        onChange={(images: UploadedImage[]) => updateField('images', images)}
        disabled={isSubmitting}
        imagesError={errors.images}
        aiAutofillRemaining={aiAutofillRemaining}
        onAiSuggestions={handleAiSuggestions}
        aiSuggestionApplied={aiSuggestionApplied}
      />
      <ListingVideoCard
        videoUrl={formData.videoUrl}
        videoThumbUrl={formData.videoThumbUrl}
        videoDurationSeconds={formData.videoDurationSeconds}
        onVideoChange={(video) => {
          updateField('videoUrl', video?.url ?? null);
          updateField('videoThumbUrl', video?.thumbUrl ?? null);
          updateField('videoDurationSeconds', video?.durationSeconds ?? null);
        }}
        disabled={isSubmitting}
      />
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g., Nike Air Max 90 - Size 10"
              maxLength={MAX_TITLE_LENGTH}
              disabled={isSubmitting}
              className={errors.title ? 'border-destructive' : ''}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{errors.title}</span>
              <span>{formData.title.length}/{MAX_TITLE_LENGTH}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe your item, including condition details, measurements, etc."
              rows={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
              disabled={isSubmitting}
              className={errors.description ? 'border-destructive' : ''}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{errors.description}</span>
              <span>{formData.description.length}/{MAX_DESCRIPTION_LENGTH}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <CategoryPicker
              value={formData.category}
              onChange={(cat: CategorySearchResult | null) => updateField('category', cat)}
              disabled={isSubmitting}
              error={errors.category}
            />
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <ConditionSelect
              value={formData.condition}
              onChange={(cond: ListingCondition | null) => updateField('condition', cond)}
              disabled={isSubmitting}
              error={errors.condition}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              placeholder="e.g., Nike, Adidas, Zara"
              disabled={isSubmitting}
              className={errors.brand ? 'border-destructive' : ''}
            />
            {errors.brand && <p className="text-sm text-destructive">{errors.brand}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagsInput
              value={formData.tags}
              onChange={(tags) => updateField('tags', tags)}
              disabled={isSubmitting}
              error={errors.tags}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={MAX_QUANTITY}
              value={formData.quantity}
              onChange={(e) => updateField('quantity', Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isSubmitting}
              className={errors.quantity ? 'border-destructive' : ''}
            />
            {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Price</Label>
              <PriceInput
                value={formData.priceCents}
                onChange={(cents) => updateField('priceCents', cents)}
                disabled={isSubmitting}
                error={errors.price}
              />
              {aiPriceHint && (
                <p className="text-xs text-muted-foreground">{aiPriceHint}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Original Price (optional)</Label>
              <PriceInput
                value={formData.originalPriceCents ?? 0}
                onChange={(cents) => updateField('originalPriceCents', cents > 0 ? cents : null)}
                disabled={isSubmitting}
                error={errors.originalPrice}
              />
              <p className="text-xs text-muted-foreground">Shows buyers the original retail price</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>COGS (optional)</Label>
            <PriceInput
              value={formData.cogsCents ?? 0}
              onChange={(cents) => updateField('cogsCents', cents > 0 ? cents : null)}
              disabled={isSubmitting}
              error={errors.cogs}
            />
            <p className="text-xs text-muted-foreground">
              What did you pay? For your records only — not shown to buyers
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <OffersSection
            allowOffers={formData.allowOffers}
            autoAcceptOfferCents={formData.autoAcceptOfferCents}
            autoDeclineOfferCents={formData.autoDeclineOfferCents}
            onAllowOffersChange={(checked) => updateField('allowOffers', checked)}
            onAutoAcceptChange={(cents) => updateField('autoAcceptOfferCents', cents)}
            onAutoDeclineChange={(cents) => updateField('autoDeclineOfferCents', cents)}
            errors={errors}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
        </CardHeader>
        <CardContent>
          <ShippingSection
            freeShipping={formData.freeShipping}
            shippingCents={formData.shippingCents}
            weightOz={formData.weightOz}
            lengthIn={formData.lengthIn}
            widthIn={formData.widthIn}
            heightIn={formData.heightIn}
            onFreeShippingChange={(checked) => {
              updateField('freeShipping', checked);
              if (checked) updateField('shippingCents', 0);
            }}
            onShippingCentsChange={(val) => updateField('shippingCents', val)}
            onWeightChange={(val) => updateField('weightOz', val)}
            onLengthChange={(val) => updateField('lengthIn', val)}
            onWidthChange={(val) => updateField('widthIn', val)}
            onHeightChange={(val) => updateField('heightIn', val)}
            errors={errors}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>
      <FulfillmentSection
        fulfillmentType={formData.fulfillmentType}
        localPickupRadiusMiles={formData.localPickupRadiusMiles}
        localHandlingFlags={formData.localHandlingFlags}
        onFulfillmentTypeChange={(val) => {
          updateField('fulfillmentType', val);
          if (val === 'SHIP_ONLY') updateField('localHandlingFlags', []);
        }}
        onPickupRadiusChange={(val) => updateField('localPickupRadiusMiles', val)}
        onHandlingFlagsChange={(flags) => updateField('localHandlingFlags', flags)}
        disabled={isSubmitting}
      />

      <ListingFormActions
        isSubmitting={isSubmitting}
        onSaveDraft={() => handleSubmit('DRAFT')}
        onPublish={() => handleSubmit('ACTIVE')}
      />
    </div>
  );
}