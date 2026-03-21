'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCase } from '@/lib/actions/helpdesk-cases';

const CASE_TYPES = [
  { value: 'SUPPORT', label: 'General Question' },
  { value: 'ORDER', label: 'Order Issue' },
  { value: 'RETURN', label: 'Return or Refund' },
  { value: 'BILLING', label: 'Billing & Payments' },
  { value: 'ACCOUNT', label: 'Account & Settings' },
] as const;

type CaseTypeValue = (typeof CASE_TYPES)[number]['value'];

interface ContactCaseFormProps {
  prefillType?: string;
  prefillOrderId?: string;
  prefillListingId?: string;
}

function isValidCaseType(value: string | undefined): value is CaseTypeValue {
  return CASE_TYPES.some((t) => t.value === value);
}

export function ContactCaseForm({
  prefillType,
  prefillOrderId,
  prefillListingId,
}: ContactCaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<CaseTypeValue>(
    isValidCaseType(prefillType) ? prefillType : 'SUPPORT'
  );
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState(prefillOrderId ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createCase({
        type,
        subject: subject.trim(),
        description: description.trim(),
        orderId: orderId.trim() || undefined,
        listingId: prefillListingId || undefined,
      });

      if (result.success && result.data) {
        router.push(`/my/support`);
      } else {
        setError(result.error ?? 'Failed to submit your case. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type */}
      <div>
        <label
          htmlFor="case-type"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          What do you need help with?
        </label>
        <select
          id="case-type"
          value={type}
          onChange={(e) => setType(e.target.value as CaseTypeValue)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          {CASE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Order ID — shown for ORDER / RETURN */}
      {(type === 'ORDER' || type === 'RETURN') && (
        <div>
          <label
            htmlFor="order-id"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Order number (optional)
          </label>
          <input
            id="order-id"
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="TWC-000000"
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      )}

      {/* Subject */}
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Subject <span className="text-gray-400 font-normal">(10–200 characters)</span>
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of your issue"
          maxLength={200}
          disabled={isPending}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-400">{subject.length}/200</p>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description <span className="text-gray-400 font-normal">(50–5000 characters)</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please describe your issue in detail, including any relevant order numbers or dates."
          rows={6}
          maxLength={5000}
          disabled={isPending}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
        />
        <p className="mt-1 text-xs text-gray-400">{description.length}/5000</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || subject.length < 10 || description.length < 50}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Submitting…' : 'Submit Case'}
      </button>
    </form>
  );
}
