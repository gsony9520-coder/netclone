"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };

export default function InlineActionSelect({
  action,
  options,
  placeholder,
  hidden,
  name,
  className,
  initialValue,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: Option[];
  placeholder: string;
  hidden: Record<string, string>;
  name: string;
  className?: string;
  initialValue?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState<string>(initialValue || "");

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  const hiddenEntries = useMemo(() => Object.entries(hidden || {}), [hidden]);

  return (
    <form ref={formRef} action={action} className={className}>
      {hiddenEntries.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (!next) return;
          formRef.current?.requestSubmit();
        }}
        className={`h-7 w-full rounded px-2 text-xs outline-none ring-1 hover:bg-zinc-700 ${
          value && value !== '__remove__'
            ? 'bg-emerald-900/60 text-emerald-100 ring-emerald-600/70'
            : 'bg-zinc-800 text-zinc-200 ring-zinc-700'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </form>
  );
}
