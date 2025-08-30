import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-[rgb(var(--color-primary))] text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-white",
    secondary:
      "bg-[rgb(var(--color-card))] text-white/90 hover:text-white border border-white/10",
    ghost: "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
  } as const;
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}