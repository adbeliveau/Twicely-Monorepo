export type AuthenticationRequestResult = {
  id: string;
  listingId: string;
  orderId: string | null;
  sellerId: string;
  buyerId: string | null;
  initiator: string;
  tier: string;
  status: string;
  totalFeeCents: number;
  buyerFeeCents: number | null;
  sellerFeeCents: number | null;
  refundedBuyerCents: number;
  certificateNumber: string | null;
  certificateUrl: string | null;
  verifyUrl: string | null;
  photosHash: string | null;
  photoUrls: string[] | null;
  resultNotes: string | null;
  authenticatorId: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export type AuthenticatorPartnerSummary = {
  id: string;
  name: string;
  specialties: string[];
  isActive: boolean;
  completedCount: number;
  accuracyRate: number | null;
  avgTurnaroundHours: number | null;
};

export type CertificateVerification = {
  certificateNumber: string;
  status: 'VALID' | 'EXPIRED' | 'TRANSFERRED' | 'REVOKED' | 'NOT_FOUND';
  authenticationType: string | null;
  authenticationDate: Date | null;
  listingTitle: string | null;
  listingThumbnailUrl: string | null;
  authenticatorName: string | null;
  photoUrls: string[] | null;
  message: string;
};

export type AuthCostSplit = {
  totalFeeCents: number;
  buyerShareCents: number;
  sellerShareCents: number;
};
