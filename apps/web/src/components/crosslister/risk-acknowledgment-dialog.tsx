'use client';

/**
 * RiskAcknowledgmentDialog — Poshmark ToS risk acknowledgment.
 * Required before enabling Posh sharing. Mode 3 (session-based automation).
 * Source: F6 install prompt §B.2; Lister Canonical Section 16.3.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { Checkbox } from '@twicely/ui/checkbox';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';

interface RiskAcknowledgmentDialogProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function RiskAcknowledgmentDialog({
  open,
  onAccept,
  onCancel,
}: RiskAcknowledgmentDialogProps) {
  const [checked, setChecked] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onCancel();
  };

  const handleAccept = () => {
    if (!checked) return;
    onAccept();
    setChecked(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Poshmark Sharing — Risk Notice</DialogTitle>
          <DialogDescription className="text-sm">
            Poshmark&apos;s Terms of Service prohibit automation. Using this feature may result
            in account restrictions on Poshmark. Twicely is a tool provider and is not
            responsible for actions taken on third-party platforms at your direction.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="posh-risk-accept"
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
          />
          <Label htmlFor="posh-risk-accept" className="text-sm leading-snug cursor-pointer">
            I understand and accept the risks of using automated Poshmark sharing.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!checked}>
            Enable Posh Sharing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
