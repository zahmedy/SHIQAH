import { useId } from "react";

type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "GARAJ logo" }: LogoMarkProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      className={className}
      viewBox="0 0 360 280"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#01060e" />
          <stop offset="52%" stopColor="#081726" />
          <stop offset="100%" stopColor="#0f2236" />
        </linearGradient>
      </defs>

      <path
        fill={`url(#${gradientId})`}
        d="M82 26h236l-8 31H137c-22 0-40 15-45 37l-21 98c-8 39 22 76 62 76h100c20 0 38-14 43-34l20-89H105l8-31h222l-27 121c-8 36-40 61-77 61H133c-60 0-106-55-94-115l20-97C66 50 92 26 82 26z"
      />

      <path fill="#ffffff" d="M136 78h176l-6 19H131c-15 0-28 10-31 25l-18 83c-5 24 13 46 37 46l11 3h-2c-34 0-58-30-51-63l18-83c5-19 22-30 41-30z" />
      <rect x="130" y="84" width="174" height="14" fill="#2f9d2f" rx="7" />
      <rect x="124" y="109" width="175" height="13" fill="#2f9d2f" rx="6.5" />

      <path
        fill="#ffffff"
        d="M132 197h93c3 0 6 3 6 6v21h22v-21c0-3 3-6 6-6h17c4 0 8-4 8-8v-20c0-3-2-6-5-8l-13-12c-4-4-8-8-13-13-3-4-8-6-13-7-32-5-65-5-97 0-5 1-10 3-13 7-5 5-9 9-13 13l-13 12c-3 2-5 5-5 8v20c0 4 4 8 8 8h17c3 0 6 3 6 6v21h22v-21c0-3 3-6 6-6zm17-48c2-4 6-7 11-8 27-3 55-3 82 0 5 1 9 4 11 8l13 20H135l14-20zm-11 39-24-5 2-12 35 8c2 1 4 2 4 5v4h-17zm130 0h-17v-4c0-3 2-4 4-5l35-8 2 12-24 5z"
      />
    </svg>
  );
}
