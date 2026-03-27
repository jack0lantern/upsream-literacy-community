"use client";

import { useState } from "react";

export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
      <p>
        Please verify your email address. Check your inbox for a verification
        link.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800 font-medium ml-4 shrink-0"
        aria-label="Dismiss verification reminder"
      >
        Dismiss
      </button>
    </div>
  );
}
