import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { Label } from '@twicely/ui/label';
import { Input } from '@twicely/ui/input';
import { Checkbox } from '@twicely/ui/checkbox';
import { LOCAL_HANDLING_FLAGS, HANDLING_FLAG_LABELS } from '@/lib/local/handling-flags';

type FulfillmentType = 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL';

interface FulfillmentSectionProps {
  fulfillmentType: FulfillmentType;
  localPickupRadiusMiles: number | null;
  localHandlingFlags: string[];
  onFulfillmentTypeChange: (value: FulfillmentType) => void;
  onPickupRadiusChange: (value: number) => void;
  onHandlingFlagsChange: (flags: string[]) => void;
  disabled?: boolean;
}

export function FulfillmentSection({
  fulfillmentType,
  localPickupRadiusMiles,
  localHandlingFlags,
  onFulfillmentTypeChange,
  onPickupRadiusChange,
  onHandlingFlagsChange,
  disabled,
}: FulfillmentSectionProps) {
  const isLocal = fulfillmentType === 'LOCAL_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL';

  function handleFlagToggle(flag: string, checked: boolean): void {
    if (checked) {
      onHandlingFlagsChange([...localHandlingFlags, flag]);
    } else {
      onHandlingFlagsChange(localHandlingFlags.filter((f) => f !== flag));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fulfillment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={fulfillmentType}
          onValueChange={(val) => onFulfillmentTypeChange(val as FulfillmentType)}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="SHIP_ONLY" id="ship-only" />
            <Label htmlFor="ship-only">Ship Only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="LOCAL_ONLY" id="local-only" />
            <Label htmlFor="local-only">Local Pickup Only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="SHIP_AND_LOCAL" id="ship-and-local" />
            <Label htmlFor="ship-and-local">Ship &amp; Local Pickup</Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          {fulfillmentType === 'SHIP_AND_LOCAL' && 'Buyers choose at checkout'}
          {fulfillmentType === 'LOCAL_ONLY' && 'Item available for local pickup only'}
        </p>

        {isLocal && (
          <div className="space-y-2">
            <Label htmlFor="pickup-radius">Pickup radius (miles)</Label>
            <Input
              id="pickup-radius"
              type="number"
              min={1}
              max={50}
              value={localPickupRadiusMiles ?? 25}
              onChange={(e) => onPickupRadiusChange(parseInt(e.target.value) || 25)}
              disabled={disabled}
            />
            <p className="text-sm text-muted-foreground">How far you&apos;re willing to travel (max 50 miles)</p>
          </div>
        )}

        {isLocal && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Pickup Requirements (optional)</Label>
            <div className="space-y-2">
              {LOCAL_HANDLING_FLAGS.map((flag) => (
                <div key={flag} className="flex items-start space-x-2">
                  <Checkbox
                    id={`flag-${flag}`}
                    checked={localHandlingFlags.includes(flag)}
                    onCheckedChange={(checked) => handleFlagToggle(flag, checked === true)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`flag-${flag}`}
                    className="text-sm font-normal leading-snug cursor-pointer"
                  >
                    {HANDLING_FLAG_LABELS[flag]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
