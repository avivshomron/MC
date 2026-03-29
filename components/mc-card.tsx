export function McCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--mc-border)] bg-[var(--mc-surface)] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
