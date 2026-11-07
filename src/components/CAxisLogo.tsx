import React, { useId } from 'react';

interface CAxisLogoProps {
  /** Container dimension class, defaults to "h-[30px] w-[30px]" */
  containerClassName?: string;
  /** SVG dimension class, defaults to "h-5 w-5" */
  svgClassName?: string;
}

export const CAxisLogo: React.FC<CAxisLogoProps> = ({
  containerClassName = 'h-[30px] w-[30px]',
  svgClassName = 'h-5 w-5',
}) => {
  const gradientId = useId();

  return (
    <div
      className={`${containerClassName} rounded-lg bg-gradient-to-b from-zinc-800/90 to-zinc-950 border border-white/25 shadow-[0_0_18px_rgba(255,255,255,0.22)] flex items-center justify-center shrink-0`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={svgClassName}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="2"
            y1="4"
            x2="30"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
        </defs>
        {/* Bold geometric C arc on left */}
        <path
          d="M 12.5 10.65 A 6.25 6.25 0 1 0 12.5 21.35"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Crisp coordinate axis crosshair (+) in center */}
        <path
          d="M 16 5.5 L 16 26.5 M 12.5 16 L 19.25 16"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Sharp geometric X on right */}
        <path
          d="M 20.75 10.25 L 28.5 21.75 M 28.5 10.25 L 20.75 21.75"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
