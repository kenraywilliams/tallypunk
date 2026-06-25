type LogoProps = { size?: number; className?: string };

// TallyPunk mark: four tally bars with a lightning-bolt crossbar (final, Plan A).
export default function Logo({ size = 26, className = "mark" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="TallyPunk"
    >
      <g stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
        <path d="M8.75 9v22M16.25 9v22M23.75 9v22M31.25 9v22" />
      </g>
      <path
        fill="currentColor"
        d="M3.36 32.38 L19.10 19.49 L19.10 24.99 L37.30 8.38 L36.64 7.62 L20.90 20.51 L20.90 15.01 L2.70 31.62 Z"
      />
      <circle fill="currentColor" cx="3.03" cy="32" r="0.5" />
      <circle fill="currentColor" cx="36.97" cy="8" r="0.5" />
    </svg>
  );
}
