import React from "react";

interface SankenLogoProps {
  className?: string;
  variant?: "full" | "diamonds";
  mode?: "light" | "dark";
}

export const SankenLogo: React.FC<SankenLogoProps> = ({
  className = "h-12",
  variant = "full",
  mode = "light",
}) => {
  const textColor = mode === "dark" ? "#FDFBF6" : "#111827";

  if (variant === "diamonds") {
    return (
      <svg
        viewBox="10 25 160 110"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        referrerPolicy="no-referrer"
      >
        <defs>
          <filter id="logo-shadow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.25" floodColor="#000000" />
          </filter>
          <linearGradient id="diamond-grad-1-sm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7fc3ff" />
            <stop offset="50%" stopColor="#3b9dff" />
            <stop offset="100%" stopColor="#1276e0" />
          </linearGradient>
          <linearGradient id="diamond-grad-2-sm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#89cbff" />
            <stop offset="50%" stopColor="#4ba5ff" />
            <stop offset="100%" stopColor="#1c81ef" />
          </linearGradient>
          <linearGradient id="diamond-grad-3-sm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#96d4ff" />
            <stop offset="50%" stopColor="#5babff" />
            <stop offset="100%" stopColor="#298dfc" />
          </linearGradient>
        </defs>

        {/* Left Diamond (Back) */}
        <rect
          x="25"
          y="45"
          width="70"
          height="70"
          rx="6"
          transform="rotate(45 60 80)"
          fill="url(#diamond-grad-1-sm)"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.5"
          filter="url(#logo-shadow-sm)"
        />

        {/* Middle Diamond */}
        <rect
          x="55"
          y="45"
          width="70"
          height="70"
          rx="6"
          transform="rotate(45 90 80)"
          fill="url(#diamond-grad-2-sm)"
          stroke="rgba(255, 255, 255, 0.90)"
          strokeWidth="1.5"
          filter="url(#logo-shadow-sm)"
        />

        {/* Right Diamond (Front) */}
        <rect
          x="85"
          y="45"
          width="70"
          height="70"
          rx="6"
          transform="rotate(45 120 80)"
          fill="url(#diamond-grad-3-sm)"
          stroke="rgba(255, 255, 255, 0.95)"
          strokeWidth="1.5"
          filter="url(#logo-shadow-sm)"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 15 440 130"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      referrerPolicy="no-referrer"
    >
      <defs>
        <filter id="logo-shadow-full" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodOpacity="0.25" floodColor="#000000" />
        </filter>
        <filter id="text-shadow-full" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="1.5" dy="1.5" stdDeviation="1" floodOpacity="0.35" floodColor="#000000" />
        </filter>
        <linearGradient id="diamond-grad-1-full" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7fc3ff" />
          <stop offset="50%" stopColor="#3b9dff" />
          <stop offset="100%" stopColor="#1276e0" />
        </linearGradient>
        <linearGradient id="diamond-grad-2-full" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#89cbff" />
          <stop offset="50%" stopColor="#4ba5ff" />
          <stop offset="100%" stopColor="#1c81ef" />
        </linearGradient>
        <linearGradient id="diamond-grad-3-full" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#96d4ff" />
          <stop offset="50%" stopColor="#5babff" />
          <stop offset="100%" stopColor="#298dfc" />
        </linearGradient>
      </defs>

      {/* Left Diamond (Back) */}
      <rect
        x="25"
        y="45"
        width="70"
        height="70"
        rx="6"
        transform="rotate(45 60 80)"
        fill="url(#diamond-grad-1-full)"
        stroke="rgba(255, 255, 255, 0.85)"
        strokeWidth="1.5"
        filter="url(#logo-shadow-full)"
      />

      {/* Middle Diamond */}
      <rect
        x="55"
        y="45"
        width="70"
        height="70"
        rx="6"
        transform="rotate(45 90 80)"
        fill="url(#diamond-grad-2-full)"
        stroke="rgba(255, 255, 255, 0.90)"
        strokeWidth="1.5"
        filter="url(#logo-shadow-full)"
      />

      {/* Right Diamond (Front) */}
      <rect
        x="85"
        y="45"
        width="70"
        height="70"
        rx="6"
        transform="rotate(45 120 80)"
        fill="url(#diamond-grad-3-full)"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth="1.5"
        filter="url(#logo-shadow-full)"
      />

      {/* Sanken Text */}
      <text
        x="175"
        y="74"
        fill={textColor}
        fontFamily="Playfair Display, Georgia, 'Times New Roman', serif"
        fontSize="44"
        fontWeight="900"
        fontStyle="italic"
        filter="url(#text-shadow-full)"
        letterSpacing="-0.5px"
      >
        Sanken
      </text>

      {/* Overseas Text */}
      <text
        x="200"
        y="118"
        fill={textColor}
        fontFamily="Playfair Display, Georgia, 'Times New Roman', serif"
        fontSize="44"
        fontWeight="900"
        fontStyle="italic"
        filter="url(#text-shadow-full)"
        letterSpacing="-0.5px"
      >
        Overseas
      </text>
    </svg>
  );
};
