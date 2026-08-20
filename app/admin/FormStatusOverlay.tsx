"use client";

import { useFormStatus } from "react-dom";

export default function FormStatusOverlay({ pendingText }: { pendingText: string }) {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-4 text-sm font-semibold text-emerald-100 shadow-2xl">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent" />
        <span>{pendingText}</span>
      </div>
    </div>
  );
}
