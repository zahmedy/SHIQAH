type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "GARAJ logo" }: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="8" width="144" height="144" rx="32" fill="#ffffff" stroke="#0f172a" strokeWidth="4" />
      <circle cx="80" cy="80" r="46" fill="none" stroke="#16a34a" strokeWidth="12" strokeLinecap="round" />
      <rect x="86" y="74" width="36" height="16" rx="8" fill="#0f172a" />
      <circle cx="62" cy="80" r="6" fill="#0f172a" />
    </svg>
  );
}
