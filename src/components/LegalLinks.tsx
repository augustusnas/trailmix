import Link from "next/link";

/** "Privacy · Terms", wherever Privacy is linked (Welcome and the shared mix page). */
export function LegalLinks({ color }: { color?: string }) {
  return (
    <p className="credit" data-testid="legal-links">
      <Link href="/privacy" style={{ color }}>
        Privacy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms" style={{ color }}>
        Terms
      </Link>
    </p>
  );
}
