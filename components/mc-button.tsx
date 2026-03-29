import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function McButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles = {
    primary:
      "bg-[var(--mc-accent)] text-white hover:bg-[var(--mc-accent-hover)] shadow-sm",
    secondary:
      "bg-[var(--mc-surface)] text-[var(--mc-text)] border border-[var(--mc-border)] hover:bg-slate-50",
    ghost: "text-[var(--mc-muted)] hover:text-[var(--mc-text)] hover:bg-slate-100",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} type="button" {...rest}>
      {children}
    </button>
  );
}
