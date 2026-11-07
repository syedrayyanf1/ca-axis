import React from 'react';

interface AnimatedBackgroundProps {
  /** Reduces ambient animation opacity by 60% during active timed exam simulations */
  isExamFocus?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  isExamFocus = false,
}) => {
  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none transition-opacity duration-700 ${
        isExamFocus ? 'opacity-40' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* =====================================================================
          LAYER 1: Slow-Drifting Aurora / Mesh Orbs (18s–25s infinite loops)
         ===================================================================== */}
      {/* Orb 1 (Top-Left): Indigo/Violet glow */}
      <div className="animate-orb-1 absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full bg-indigo-400/10 dark:bg-indigo-500/12 blur-[120px]" />

      {/* Orb 2 (Top-Right / Center): Subtle Cyan/Slate glow */}
      <div className="animate-orb-2 absolute top-[12%] -right-20 h-[440px] w-[440px] rounded-full bg-sky-400/10 dark:bg-sky-500/10 blur-[120px]" />

      {/* Orb 3 (Bottom-Center): Soft Emerald/Teal accent */}
      <div className="animate-orb-3 absolute -bottom-36 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-400/[0.08] dark:bg-emerald-500/[0.08] blur-[120px]" />

      {/* =====================================================================
          LAYER 2: Subtle Coordinate Axis Grid with Radial Fade Mask
         ===================================================================== */}
      <div className="caxis-coord-grid absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_20%,#000_40%,transparent_100%)]" />

      {/* =====================================================================
          LAYER 3: Floating Geometric Axis Shapes (SVG)
         ===================================================================== */}
      {/* Shape 1: Top-Left Precision Coordinate Crosshair (+) */}
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className="animate-axis-geo absolute top-24 left-[8%] h-14 w-14 text-zinc-500 dark:text-zinc-300 opacity-20"
      >
        <line x1="32" y1="6" x2="32" y2="58" stroke="currentColor" strokeWidth="1" />
        <line x1="6" y1="32" x2="58" y2="32" stroke="currentColor" strokeWidth="1" />
        <circle cx="32" cy="32" r="9" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="29" y1="18" x2="35" y2="18" stroke="currentColor" strokeWidth="1" />
        <line x1="29" y1="46" x2="35" y2="46" stroke="currentColor" strokeWidth="1" />
        <line x1="18" y1="29" x2="18" y2="35" stroke="currentColor" strokeWidth="1" />
        <line x1="46" y1="29" x2="46" y2="35" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Shape 2: Upper-Right Slow-Rotating Faint Isometric Coordinate Ring */}
      <div className="animate-axis-geo-slow absolute top-28 right-[9%] opacity-20">
        <svg
          viewBox="0 0 140 140"
          fill="none"
          className="animate-spin-axis-slow h-32 w-32 text-indigo-400 dark:text-indigo-300"
        >
          <circle
            cx="70"
            cy="70"
            r="56"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
          <circle cx="70" cy="70" r="38" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
          <line x1="70" y1="4" x2="70" y2="22" stroke="currentColor" strokeWidth="1.2" />
          <line x1="70" y1="118" x2="70" y2="136" stroke="currentColor" strokeWidth="1.2" />
          <line x1="4" y1="70" x2="22" y2="70" stroke="currentColor" strokeWidth="1.2" />
          <line x1="118" y1="70" x2="136" y2="70" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>

      {/* Shape 3: Mid-Left Diagonal Axis Beam & Coordinate Reticle */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className="animate-axis-geo-slow absolute top-[52%] left-[4%] h-24 w-24 text-zinc-400 dark:text-zinc-400 opacity-15"
      >
        <line x1="10" y1="110" x2="110" y2="10" stroke="currentColor" strokeWidth="1" />
        <line
          x1="28"
          y1="110"
          x2="110"
          y2="28"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="4 4"
        />
        <rect
          x="52"
          y="52"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="1"
          transform="rotate(45 60 60)"
        />
      </svg>

      {/* Shape 4: Lower-Right Coordinate Crosshair (+) */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="animate-axis-geo absolute bottom-24 right-[14%] h-11 w-11 text-sky-400 dark:text-sky-300 opacity-20"
      >
        <line x1="24" y1="4" x2="24" y2="44" stroke="currentColor" strokeWidth="1" />
        <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1" />
        <rect x="20" y="20" width="8" height="8" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Shape 5: Bottom-Left Subtle Axis Corner Bracket */}
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className="animate-axis-geo absolute bottom-16 left-[18%] h-16 w-16 text-emerald-400 dark:text-emerald-300 opacity-15"
      >
        <path d="M 14 46 L 14 14 L 46 14" stroke="currentColor" strokeWidth="1" />
        <line
          x1="14"
          y1="14"
          x2="64"
          y2="64"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="3 5"
        />
        <circle cx="14" cy="14" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
};
