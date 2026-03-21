"use client";

import { useState, useTransition } from "react";
import { updateAgentSignature } from "@/lib/actions/helpdesk-signature";

interface SignatureEditorProps {
  initialSignature: string | null;
}

export function SignatureEditor({ initialSignature }: SignatureEditorProps) {
  const [signature, setSignature] = useState(initialSignature ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateAgentSignature({ signatureHtml: signature });
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <section className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Message Signature</h2>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">Signature (plain text, shown on outbound messages)</p>
          <textarea
            value={signature}
            onChange={(e) => { setSignature(e.target.value); setSaved(false); }}
            rows={4}
            maxLength={2000}
            placeholder={"Best regards,\nYour Name\nTwicely Support Team"}
            className="w-full resize-none rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <p className="text-xs text-gray-400 mt-1">{signature.length}/2000 characters</p>
        </div>

        {signature && (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="text-xs border-t border-gray-200 pt-2 text-gray-500">
              <hr className="my-2 border-gray-200" />
              <span className="whitespace-pre-wrap">{signature}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
