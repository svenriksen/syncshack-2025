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
      "bg-[rgb(var(--color-primary))] text-black hover:bg-[rgb(var(--color-primary-600))] hover:text-black",
    secondary:
      "bg-[rgb(var(--color-card))] text-[rgb(var(--color-foreground))/0.9] hover:text-[rgb(var(--color-foreground))] border border-[rgb(var(--color-foreground))/0.12]",
    ghost: "bg-transparent text-[rgb(var(--color-foreground))/0.85] hover:text-[rgb(var(--color-foreground))] hover:bg-[rgb(var(--color-foreground))/0.06]",
  } as const;
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className} cursor-pointer`}
      {...props}
    >
      {children}
    </button>
  );
}