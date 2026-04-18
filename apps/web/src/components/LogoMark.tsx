type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "AutoIntel logo" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 238 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mark-gradient" x1="10" y1="9" x2="54" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B83D3" />
          <stop offset="1" stopColor="#0B3F73" />
        </linearGradient>
      </defs>

      <g>
        <rect x="7" y="8" width="48" height="48" rx="14" fill="url(#mark-gradient)" />
        <path
          d="M20 39.5 29.2 18h4.1l9.2 21.5h-5.3l-1.7-4.3h-8.7l-1.7 4.3H20Zm8.5-8.7h5.3l-2.6-6.8-2.7 6.8Z"
          fill="#FFFFFF"
        />
        <path d="M43.5 18v21.5" stroke="#D72638" strokeWidth="4.4" strokeLinecap="round" />
      </g>

      <g>
        <text
          x="68"
          y="33"
          fill="#082033"
          fontFamily="Rajdhani, Eurostile, Trebuchet MS, sans-serif"
          fontSize="31"
          fontWeight="800"
          letterSpacing="0.2"
        >
          AutoIntel
        </text>
        <text
          x="70"
          y="49"
          fill="#5F7486"
          fontFamily="Cairo, Avenir Next, Segoe UI, sans-serif"
          fontSize="10"
          fontWeight="800"
          letterSpacing="1.6"
        >
          CURATED USED CARS
        </text>
      </g>
    </svg>
  );
}
