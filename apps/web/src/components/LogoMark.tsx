type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "NicheRides logo" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 224 56"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <rect x="6" y="8" width="40" height="40" rx="10" fill="#0F766E" />
        <text
          x="26"
          y="35"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="Manrope, Avenir Next, Segoe UI, sans-serif"
          fontSize="22"
          fontWeight="800"
          letterSpacing="0"
        >
          N
        </text>
      </g>

      <g>
        <text
          x="58"
          y="30"
          fill="#0F172A"
          fontFamily="Manrope, Avenir Next, Segoe UI, sans-serif"
          fontSize="25"
          fontWeight="800"
          letterSpacing="0"
        >
          NicheRides
        </text>
        <text
          x="59"
          y="44"
          fill="#64748B"
          fontFamily="Manrope, Avenir Next, Segoe UI, sans-serif"
          fontSize="9"
          fontWeight="800"
          letterSpacing="0"
        >
          FIND THE RIGHT FIT
        </text>
      </g>
    </svg>
  );
}
