type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "NicheRides logo" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 178 44"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text y="31" fontFamily="Manrope, Avenir Next, Segoe UI, sans-serif" letterSpacing="0">
        <tspan x="4" fill="#0f766e" fontSize="26" fontStyle="italic" fontWeight="800">
          Niche
        </tspan>
        <tspan fill="#0f172a" fontSize="30" fontWeight="800">
          Rides
        </tspan>
      </text>
      <rect x="5" y="36" width="28" height="3" rx="1.5" fill="#0f766e" />
    </svg>
  );
}
