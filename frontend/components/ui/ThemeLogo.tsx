/**
 * ThemeLogo – shows the black logo in light mode, white logo in dark mode.
 * CSS-only switching (dark: Tailwind variant) → zero hydration flash,
 * works in both Server and Client components.
 */

interface ThemeLogoProps {
  /** Tailwind height class, e.g. "h-8" or "h-12". Defaults to "h-8". */
  height?: string;
  /** Extra classes applied to both img elements. */
  className?: string;
}

export function ThemeLogo({ height = 'h-8', className = '' }: ThemeLogoProps) {
  const base = `w-auto object-contain ${height} ${className}`.trim();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Assets/Logos/airealcheck-secondary-Black.png"
        alt="AIRealCheck"
        className={`block dark:hidden ${base}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Assets/Logos/airealcheck-secondary-White.png"
        alt="AIRealCheck"
        className={`hidden dark:block ${base}`}
      />
    </>
  );
}
