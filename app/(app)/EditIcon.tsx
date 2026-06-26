// TallyPunk edit mark — a hollow, slightly angular pencil (punk-ish).
export default function EditIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20.5 L4.5 16 L15 5.5 L19 9.5 L8.5 20 Z" />
      <path d="M13.5 7 L17.5 11" />
      <path d="M4 20.5 L8.5 20" />
    </svg>
  );
}
