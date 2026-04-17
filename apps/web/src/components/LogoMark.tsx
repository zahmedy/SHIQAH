type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "AutoIntel Buffalo Winter Cars logo" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 82"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-ice" x1="22" y1="6" x2="70" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FCFF" />
          <stop offset="0.55" stopColor="#DCEEFF" />
          <stop offset="1" stopColor="#7DB7E8" />
        </linearGradient>
        <linearGradient id="logo-navy" x1="15" y1="13" x2="76" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D6FB8" />
          <stop offset="1" stopColor="#0B3F73" />
        </linearGradient>
        <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="145%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0B3F73" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#logo-shadow)">
        <path
          d="M42 5.5c13.5 0 24.9 3.7 34.4 8.4v23.2c0 17.2-11.1 30.7-34.4 39.4C18.7 67.8 7.6 54.3 7.6 37.1V13.9C17.1 9.2 28.5 5.5 42 5.5Z"
          fill="url(#logo-ice)"
          stroke="#0B3F73"
          strokeWidth="3"
        />
        <path
          d="M17 42c9.3-10.9 18.6-14.8 29.1-14.8 8 0 14.9 2.1 21 6.7V15.7C59.8 12.5 51.5 10 42 10c-10 0-18.7 2.8-26.1 6.1v21c0 1.7.4 3.3 1.1 4.9Z"
          fill="url(#logo-navy)"
        />
        <path
          d="M15.8 44.6c6.8 10.9 20.4 18 26.2 20.5 8.1-3.4 21.2-10.6 26.5-22.1-6.2-6.2-13.5-9.2-22.4-9.2-10.8 0-20.5 4.8-30.3 10.8Z"
          fill="#F8FCFF"
        />
        <path
          d="M23 49.2c7.1-4.3 14.4-7.5 23.1-7.5 6.3 0 11.8 1.8 16.7 5.4"
          fill="none"
          stroke="#1D6FB8"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M27.5 56.8c5.8-3.2 12-5.5 19-5.5 4.4 0 8.5 1 12.3 2.8"
          fill="none"
          stroke="#D72638"
          strokeWidth="2.7"
          strokeLinecap="round"
        />
        <path
          d="M29.2 25.3c4.1-3.2 7.6-4.8 12.2-4.8h11.7l-4.4 5.3H62l-8.6 7.4H40.8c-3.2 0-6.2-.8-8.8-2.3l-6.3 3.8 2-6.4-5.1-2.2h6.6Z"
          fill="#F8FCFF"
          stroke="#F8FCFF"
          strokeLinejoin="round"
        />
        <circle cx="26.6" cy="20.6" r="2.1" fill="#F8FCFF" />
        <path d="M40.6 14.3v7.2M37 17.9h7.2" stroke="#DCEEFF" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M58.5 18.4v5.6M55.7 21.2h5.6" stroke="#DCEEFF" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      <g>
        <text
          x="92"
          y="36"
          fill="#082033"
          fontFamily="Rajdhani, Eurostile, Trebuchet MS, sans-serif"
          fontSize="34"
          fontWeight="800"
          letterSpacing="0.4"
        >
          AutoIntel
        </text>
        <path d="M94 45.5h108" stroke="#1D6FB8" strokeWidth="3" strokeLinecap="round" />
        <path d="M210 45.5h22" stroke="#D72638" strokeWidth="3" strokeLinecap="round" />
        <text
          x="94"
          y="63"
          fill="#5F7486"
          fontFamily="Cairo, Avenir Next, Segoe UI, sans-serif"
          fontSize="11"
          fontWeight="800"
          letterSpacing="2.1"
        >
          BUFFALO WINTER CARS
        </text>
      </g>
    </svg>
  );
}
