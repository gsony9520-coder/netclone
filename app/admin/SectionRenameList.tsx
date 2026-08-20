'use client';

import { useEffect, useState } from 'react';

type SectionItem = {
  key: string;
  label: string;
  isCustom: boolean;
  order?: number | null;
};

type Props = {
  sections: SectionItem[];
  supportsSortOrder: boolean;
  deleteAction: (sectionKey: string) => Promise<void> | void;
};

export default function SectionRenameList({ sections, supportsSortOrder, deleteAction }: Props) {
  const [orderedSections, setOrderedSections] = useState(sections);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOrderedSections(sections);
    setCheckedKeys(new Set());
  }, [sections]);

  const toggleChecked = (key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!supportsSortOrder) return;
    setOrderedSections((prev) => {
      const target = index + direction;
      if (target < 1 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const gridClass = 'md:grid-cols-[160px,1fr,auto]';

  return (
    <div className="mt-4 space-y-3">
      {orderedSections.map((section, index) => {
        const isHero = section.key === 'hero';
        const isFirstMovable = index <= 1;
        const isLast = index === orderedSections.length - 1;
        const canDelete = section.isCustom;
        const isChecked = canDelete && checkedKeys.has(section.key);
        return (
          <div key={section.key} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => moveSection(index, -1)}
                disabled={!supportsSortOrder || isHero || isFirstMovable}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                aria-label={`Move ${section.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSection(index, 1)}
                disabled={!supportsSortOrder || isHero || isLast}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                aria-label={`Move ${section.label} down`}
              >
                ↓
              </button>
            </div>
            <div className={`flex-1 grid gap-3 items-center ${gridClass}`}>
              <div className="text-xs uppercase tracking-wider text-zinc-500">{section.key}</div>
              <div className="relative">
                <input
                  name={`label_${section.key}`}
                  defaultValue={section.label}
                  placeholder="Enter new label"
                  className="w-full rounded bg-zinc-950 p-2.5 pr-20 text-sm outline-none ring-1 ring-zinc-800"
                />
                <label
                  htmlFor={`delete_${section.key}`}
                  className="absolute right-3 top-1/2 flex -translate-y-1/2 cursor-pointer items-center gap-2 text-[11px] text-zinc-400"
                >
                  <input
                    id={`delete_${section.key}`}
                    type="checkbox"
                    name="delete_keys"
                    value={section.key}
                    checked={isChecked}
                    onChange={() => toggleChecked(section.key)}
                    disabled={!canDelete}
                    className="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-950 text-red-500 disabled:opacity-40"
                  />
                  Delete
                </label>
              </div>
              <div className="flex items-center justify-end">
                {section.isCustom ? (
                  <button
                    type="submit"
                    formAction={deleteAction.bind(null, section.key)}
                    className="rounded bg-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-600"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500">Default</span>
                )}
              </div>
            </div>
            {supportsSortOrder ? (
              <input type="hidden" name={`order_${section.key}`} value={index + 1} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
