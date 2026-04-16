"use client";

import type { SVGProps } from "react";

import { cn } from "@/lib/mis/utils";

export function AiChatbotLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      <circle cx="32" cy="8" r="5" fill="currentColor" />
      <path d="M32 13v10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M18 24a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="10" y="20" width="44" height="20" rx="10" stroke="currentColor" strokeWidth="4.5" />
      <circle cx="7.5" cy="30" r="3" fill="currentColor" />
      <circle cx="56.5" cy="30" r="3" fill="currentColor" />
      <circle cx="24" cy="30" r="3.5" fill="currentColor" />
      <circle cx="40" cy="30" r="3.5" fill="currentColor" />
      <path d="M32 40v8" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M22 48c0-1.657 1.343-3 3-3h14c1.657 0 3 1.343 3 3v8H22v-8Z"
        fill="currentColor"
      />
    </svg>
  );
}
