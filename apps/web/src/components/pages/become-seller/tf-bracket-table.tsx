import type { TfBracket } from '@/lib/queries/become-seller';

interface TfBracketTableProps {
  brackets: TfBracket[];
}

function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function formatRate(rateBps: number): string {
  return `${(rateBps / 100).toFixed(2)}%`;
}

const BRACKET_LABELS: Record<number, string> = {
  1: '$0 – $499',
  2: '$500 – $1,999',
  3: '$2,000 – $4,999',
  4: '$5,000 – $9,999',
  5: '$10,000 – $24,999',
  6: '$25,000 – $49,999',
  7: '$50,000 – $99,999',
  8: '$100,000+',
};

export function TfBracketTable({ brackets }: TfBracketTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              Monthly Twicely sales
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground">
              Transaction fee rate
            </th>
          </tr>
        </thead>
        <tbody>
          {brackets.map((bracket) => (
            <tr
              key={bracket.bracketNumber}
              className="border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-3 text-muted-foreground">
                {BRACKET_LABELS[bracket.bracketNumber] ??
                  (bracket.maxCents === null
                    ? `No limit`
                    : `Up to ${formatDollars(bracket.maxCents)}`)}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatRate(bracket.rateBps)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
