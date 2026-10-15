import { SHOW_BETA } from "@/config/site";

/** Small lime "BETA" pill beside the wordmark. Hidden everywhere when SHOW_BETA is false. */
export function BetaPill() {
  if (!SHOW_BETA) return null;
  return (
    <span className="beta-pill" data-testid="beta-label">
      Beta
    </span>
  );
}

/** "TRAILMIX" in Space Mono, with the BETA pill beside it. */
export function Wordmark({ color }: { color?: string }) {
  return (
    <span className="wordmark" style={{ color }}>
      Trailmix
      <BetaPill />
    </span>
  );
}
