import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
export type CombinedShippingMode = 'NONE' | 'FLAT' | 'PER_ADDITIONAL' | 'AUTO_DISCOUNT' | 'QUOTED';

export interface ShippingFormData {
  name: string;
  carrier: string;
  service: string;
  handlingTimeDays: number;
  isDefault: boolean;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  combinedShippingMode: CombinedShippingMode;
  flatCombinedCents: number | null;
  additionalItemCents: number | null;
  autoDiscountPercent: number | null;
  autoDiscountMinItems: number | null;
}

interface ShippingProfileFormFieldsProps {
  formData: ShippingFormData;
  onFormDataChange: (updates: Partial<ShippingFormData>) => void;
}

export function PackageDimensionsField({ formData, onFormDataChange }: ShippingProfileFormFieldsProps) {
  return (
    <div className="space-y-2">
      <Label>Package Dimensions (optional)</Label>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Weight (oz)"
            value={formData.weightOz || ''}
            onChange={(e) => onFormDataChange({ weightOz: e.target.value ? parseFloat(e.target.value) : null })}
          />
        </div>
        <div>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Length (in)"
            value={formData.lengthIn || ''}
            onChange={(e) => onFormDataChange({ lengthIn: e.target.value ? parseFloat(e.target.value) : null })}
          />
        </div>
        <div>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Width (in)"
            value={formData.widthIn || ''}
            onChange={(e) => onFormDataChange({ widthIn: e.target.value ? parseFloat(e.target.value) : null })}
          />
        </div>
        <div>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="Height (in)"
            value={formData.heightIn || ''}
            onChange={(e) => onFormDataChange({ heightIn: e.target.value ? parseFloat(e.target.value) : null })}
          />
        </div>
      </div>
    </div>
  );
}

export function CombinedShippingField({ formData, onFormDataChange }: ShippingProfileFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="combinedShippingMode">Combined Shipping</Label>
        <Select
          value={formData.combinedShippingMode}
          onValueChange={(value: CombinedShippingMode) => onFormDataChange({ combinedShippingMode: value })}
        >
          <SelectTrigger id="combinedShippingMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None (charge individually)</SelectItem>
            <SelectItem value="FLAT">Flat Rate (one price for all)</SelectItem>
            <SelectItem value="PER_ADDITIONAL">Per Additional Item</SelectItem>
            <SelectItem value="AUTO_DISCOUNT">Auto Discount (%)</SelectItem>
            <SelectItem value="QUOTED" disabled>Quoted (Coming Soon)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {formData.combinedShippingMode === 'NONE' && 'Each item ships at its individual rate.'}
          {formData.combinedShippingMode === 'FLAT' && 'All items ship together for one flat price.'}
          {formData.combinedShippingMode === 'PER_ADDITIONAL' && 'First item full price, additional items at reduced rate.'}
          {formData.combinedShippingMode === 'AUTO_DISCOUNT' && 'Automatic % off shipping when buyer orders multiple items.'}
        </p>
      </div>

      {formData.combinedShippingMode === 'FLAT' && (
        <div className="space-y-2">
          <Label htmlFor="flatCombinedCents">Flat Combined Rate *</Label>
          <div className="flex items-center gap-2">
            <span>$</span>
            <Input
              id="flatCombinedCents"
              type="number"
              min={0.01}
              step={0.01}
              value={formData.flatCombinedCents ? (formData.flatCombinedCents / 100).toFixed(2) : ''}
              onChange={(e) => onFormDataChange({ flatCombinedCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
              required
            />
          </div>
        </div>
      )}

      {formData.combinedShippingMode === 'PER_ADDITIONAL' && (
        <div className="space-y-2">
          <Label htmlFor="additionalItemCents">Additional Item Cost *</Label>
          <div className="flex items-center gap-2">
            <span>$</span>
            <Input
              id="additionalItemCents"
              type="number"
              min={0.01}
              step={0.01}
              value={formData.additionalItemCents ? (formData.additionalItemCents / 100).toFixed(2) : ''}
              onChange={(e) => onFormDataChange({ additionalItemCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
              required
            />
          </div>
        </div>
      )}

      {formData.combinedShippingMode === 'AUTO_DISCOUNT' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="autoDiscountPercent">Discount Percentage *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="autoDiscountPercent"
                type="number"
                min={10}
                max={75}
                value={formData.autoDiscountPercent || ''}
                onChange={(e) => onFormDataChange({ autoDiscountPercent: e.target.value ? parseFloat(e.target.value) : null })}
                required
              />
              <span>%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="autoDiscountMinItems">Minimum Items</Label>
            <Input
              id="autoDiscountMinItems"
              type="number"
              min={2}
              max={20}
              value={formData.autoDiscountMinItems || 2}
              onChange={(e) => onFormDataChange({ autoDiscountMinItems: e.target.value ? parseInt(e.target.value) : 2 })}
            />
          </div>
        </div>
      )}
    </>
  );
}
