"use client";
import { useRouter } from 'next/navigation';
import React from 'react';

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export default function ModeLink({ href, className, children }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => router.push(href)}
    >
      {children}
    </button>
  );
}
