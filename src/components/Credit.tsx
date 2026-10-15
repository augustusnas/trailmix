import { CREDIT_NAME, CREDIT_URL } from "@/config/site";

/** "Built by Augustus Nas". Only on Welcome, the end of the Library and the shared mix page. */
export function Credit({ linkColor }: { linkColor?: string }) {
  return (
    <p className="credit" data-testid="credit">
      Built by{" "}
      <a href={CREDIT_URL} target="_blank" rel="noopener noreferrer" style={{ color: linkColor }}>
        {CREDIT_NAME}
      </a>
    </p>
  );
}
