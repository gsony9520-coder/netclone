"use client";
import React, { useEffect, useState } from "react";

type Props = {
  name: string;
  label: string;
  accept?: string;
  className?: string;
  previewHeight?: number;
  initialUrl?: string | null;
};

export default function ImageFileInput({ name, label, accept = "image/*", className, previewHeight = 160, initialUrl = null }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const removeFieldName = `${name}_remove`;

  const hasExisting = !!initialUrl && !removed && !preview;
  const showPreview = !removed && (preview || initialUrl);

  return (
    <div className={`rounded bg-zinc-900 p-3 ring-1 ring-zinc-800 ${className || ''}`}>
      <label className="mb-2 block text-sm text-zinc-300">{label}</label>

      <input
        ref={inputRef}
        name={name}
        type="file"
        accept={accept}
        className="w-full text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          setFile(f);
          setRemoved(false);
        }}
      />

      {removed ? (
        <>
          <input type="hidden" name={removeFieldName} value="1" />
          <div className="mt-3 text-xs text-zinc-400">Marked for removal</div>
        </>
      ) : null}

      {showPreview ? (
        <div className="mt-3">
          <div className="relative overflow-hidden rounded" style={{ height: previewHeight }}>
            <img src={preview || (initialUrl as string)} alt="Preview" className="h-full w-auto object-contain" />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </button>
            {hasExisting ? (
              <button
                type="button"
                className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600"
                onClick={() => {
                  setRemoved(true);
                  setFile(null);
                  setPreview(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
