import { Palmtree } from 'lucide-react';

interface VacationBannerProps {
  message: string | null;
  returnDate?: Date | null;
  modeType?: string | null;
}

export function VacationBanner({ message, returnDate, modeType }: VacationBannerProps) {
  const formattedDate = returnDate
    ? returnDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  let statusText: string;
  if (modeType === 'ALLOW_SALES' && formattedDate) {
    statusText = `Seller is away until ${formattedDate}. Orders will ship after they return.`;
  } else if (formattedDate) {
    statusText = `This seller is on vacation until ${formattedDate}.`;
  } else {
    statusText = 'This seller is on vacation.';
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Palmtree className="h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">{statusText}</span>
            {message && <span className="ml-1">{message}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
