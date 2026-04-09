'use client';

/**
 * TemplateBodyFields — subject, body, and optional HTML template inputs.
 * Split from notification-template-editor.tsx to stay under 300 lines.
 */

import { useState } from 'react';

interface TemplateBodyFieldsProps {
  subjectTemplate: string;
  bodyTemplate: string;
  htmlTemplate: string;
  onChange: (patch: Partial<{ subjectTemplate: string; bodyTemplate: string; htmlTemplate: string }>) => void;
}

export function TemplateBodyFields({
  subjectTemplate,
  bodyTemplate,
  htmlTemplate,
  onChange,
}: TemplateBodyFieldsProps) {
  const [showHtml, setShowHtml] = useState(false);

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subject Template</label>
        <input
          type="text"
          value={subjectTemplate}
          onChange={(e) => onChange({ subjectTemplate: e.target.value })}
          placeholder="Your order {{orderId}} has been confirmed"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">Use {'{{variableName}}'} for dynamic content.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Body Template <span className="text-red-500">*</span>
        </label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => onChange({ bodyTemplate: e.target.value })}
          placeholder="Hi {{buyerName}}, your order for {{itemTitle}} has been confirmed."
          rows={5}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="mt-1 text-xs text-gray-400">Use {'{{variableName}}'} for dynamic content.</p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowHtml((v) => !v)}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {showHtml ? 'Hide HTML template' : 'Show HTML template'}
        </button>
        {showHtml && (
          <textarea
            value={htmlTemplate}
            onChange={(e) => onChange({ htmlTemplate: e.target.value })}
            placeholder="<p>Hi {{buyerName}},</p>"
            rows={8}
            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    </>
  );
}
