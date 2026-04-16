"use client";

export function GlowFilter({ id, color, stdDeviation = 4 }: { id: string; color: string; stdDeviation?: number }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={stdDeviation} result="blur" />
      <feFlood floodColor={color} floodOpacity="0.35" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}
