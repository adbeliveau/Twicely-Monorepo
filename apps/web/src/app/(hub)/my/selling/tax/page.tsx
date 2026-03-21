import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getTaxInfoByUserId } from '@/lib/queries/tax-info';
import { getTaxDocumentsByUserId } from '@/lib/queries/tax-documents';
import { db } from '@twicely/db';
import { affiliate } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { maskTaxId } from '@twicely/db/encryption';
import { TaxInfoForm } from '@/components/tax/tax-info-form';
import { TaxDocumentsList } from '@/components/tax/tax-documents-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tax Information | Twicely',
  robots: 'noindex',
};

export default async function TaxPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/tax');
  }

  // Allow sellers AND affiliates — affiliates need tax info for 1099-NEC
  if (!session.isSeller) {
    const [affRow] = await db
      .select({ id: affiliate.id })
      .from(affiliate)
      .where(eq(affiliate.userId, session.userId))
      .limit(1);
    if (!affRow) {
      redirect('/my/selling/onboarding');
    }
  }

  const [existingTaxInfo, taxDocuments] = await Promise.all([
    getTaxInfoByUserId(session.userId),
    getTaxDocumentsByUserId(session.userId),
  ]);

  const maskedId =
    existingTaxInfo?.taxIdLastFour && existingTaxInfo.taxIdType
      ? maskTaxId(existingTaxInfo.taxIdLastFour, existingTaxInfo.taxIdType)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tax Information</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Required for IRS 1099-K reporting when your gross sales exceed $600/year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">Your tax information is secure</CardTitle>
          </div>
          <CardDescription>
            Your tax information is encrypted and stored securely. Only you and authorized compliance staff can view it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxInfoForm
            existingTaxInfo={
              existingTaxInfo
                ? {
                    taxIdType: existingTaxInfo.taxIdType,
                    maskedTaxId: maskedId,
                    legalName: existingTaxInfo.legalName,
                    businessName: existingTaxInfo.businessName,
                    address1: existingTaxInfo.address1,
                    city: existingTaxInfo.city,
                    state: existingTaxInfo.state,
                    zip: existingTaxInfo.zip,
                    country: existingTaxInfo.country,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {taxDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax Documents</CardTitle>
            <CardDescription>
              Download your annual tax summaries. These are for your records only — official forms are filed electronically by Twicely through Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaxDocumentsList documents={taxDocuments} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
