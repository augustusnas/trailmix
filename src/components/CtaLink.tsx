import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Big rounded pill button with a label on the left and an arrow on the right. */
export function CtaLink({
  href,
  children,
  bg,
  fg,
  icon = "arrowRight",
  external = false,
  size = "large",
}: {
  href: string;
  children: ReactNode;
  bg: string;
  fg: string;
  icon?: IconName;
  external?: boolean;
  size?: "large" | "medium";
}) {
  const className = `cta cta--${size}`;
  const style = { background: bg, color: fg };
  const inner = (
    <>
      <span>{children}</span>
      <Icon name={icon} />
    </>
  );
  if (external) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {inner}
    </Link>
  );
}

/** 44px circular back button. */
export function BackLink({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <Link href={href} aria-label={label} className="icon-btn" style={{ color, borderColor: color }}>
      <Icon name="arrowLeft" size={20} />
    </Link>
  );
}
