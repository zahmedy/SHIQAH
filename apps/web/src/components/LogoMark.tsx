type LogoMarkProps = {
  className?: string;
  title?: string;
};

export default function LogoMark({ className, title = "GARAJ logo" }: LogoMarkProps) {
  return (
    <img
      className={className}
      src="/brand/garaj-logo.PNG"
      alt={title}
      loading="lazy"
    />
  );
}
