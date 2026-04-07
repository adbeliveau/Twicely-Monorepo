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
    <div className="overflow-hidden rounded-[var(--tw-r-xl)] border-[1.5px] border-[var(--tw-border)] bg-white shadow-[var(--tw-shadow-sm)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-[1.5px] border-[var(--tw-border)] bg-[var(--tw-bg)]">
            <th className="px-5 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-[var(--tw-muted-lt)]">
              Monthly Twicely sales
            </th>
            <th className="px-5 py-3.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-[var(--tw-muted-lt)]">
              Transaction fee rate
            </th>
          </tr>
        </thead>
        <tbody>
          {brackets.map((bracket, i) => (
            <tr
              key={bracket.bracketNumber}
              className={i !== brackets.length - 1 ? 'border-b border-[var(--tw-border)]' : ''}
            >
              <td className="px-5 py-3.5 font-bold text-[var(--tw-black)]">
                {BRACKET_LABELS[bracket.bracketNumber] ??
                  (bracket.maxCents === null
                    ? `No limit`
                    : `Up to ${formatDollars(bracket.maxCents)}`)}
              </td>
              <td className="px-5 py-3.5 text-right font-black text-[var(--mg)] tabular-nums">
                {formatRate(bracket.rateBps)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
