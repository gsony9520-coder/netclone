"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function ConfirmButton({
  children,
  message,
  className,
  title = "Confirm Action",
  confirmLabel = "Yes, delete",
  cancelLabel = "Cancel",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>

      {open && mounted ? createPortal(
        <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 2147483647 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">{title}</div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200">{message}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                onClick={() => {
                  setOpen(false);
                  const form = buttonRef.current?.closest("form") as HTMLFormElement | null;
                  if (form) {
                    if (typeof form.requestSubmit === "function") {
                      form.requestSubmit();
                    } else {
                      form.submit();
                    }
                  }
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
