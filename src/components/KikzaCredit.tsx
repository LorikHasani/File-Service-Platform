import React from "react";

/* KIKZA logo mark — K monogram in a red badge (red = brand accent) */
const KikzaMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="kikza-g"
        x1="0"
        y1="0"
        x2="24"
        y2="24"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#ce0707" />
        <stop offset="1" stopColor="#ce0707" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#kikza-g)" />
    <path
      d="M8 6.5V17.5M8 13L15 6.5M10.5 10.7L15.8 17.5"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * "Software by KIKZA" credit — clicking it opens WhatsApp chat.
 * variant "onDark" for always-dark surfaces (landing page),
 * "auto" adapts to light/dark theme (auth pages).
 */
export const KikzaCredit: React.FC<{
  variant?: "onDark" | "auto";
  className?: string;
}> = ({ variant = "auto", className = "" }) => {
  const label =
    variant === "onDark"
      ? "text-neutral-500 group-hover:text-neutral-300"
      : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300";
  const brand =
    variant === "onDark"
      ? "text-neutral-300 group-hover:text-white"
      : "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-white";
  return (
    <a
      href="https://wa.me/38344955389"
      target="_blank"
      rel="noreferrer"
      title="KIKZA — Software Development · WhatsApp +383 44 955 389"
      className={`group inline-flex items-center gap-2 ${className}`}
    >
      <span className={`text-xs transition-colors ${label}`}>Software by</span>
      <span className="inline-flex items-center gap-1 border p-1 rounded-lg">
        {/* <KikzaMark /> */}
        <span
          className={`text-sm font-black italic tracking-wider transition-colors ${brand}`}
        >
          KIKZA
        </span>
      </span>
    </a>
  );
};
