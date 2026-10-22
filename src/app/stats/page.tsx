import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Headline } from "@/components/Headline";
import { config } from "@/server/config";
import { checkGuest, SESSION_COOKIE } from "@/server/session";
import { MEASURES, statsData } from "@/server/statsPage";
import type { Counter } from "@/server/usage";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats", robots: { index: false, follow: false } };

const CHECKPOINTS: { counter: Counter; label: string }[] = [
  { counter: "firstMix", label: "First mix made" },
  { counter: "firstKept", label: "First mix kept" },
  { counter: "firstCarried", label: "First “Carried me”" },
  { counter: "returned", label: "Came back within 7 days" },
];
const COUNTS: { counter: Counter; label: string }[] = [
  { counter: "made", label: "Mixes made" },
  { counter: "remixes", label: "Remixes" },
  { counter: "kept", label: "Mixes kept" },
  { counter: "keptRemixes", label: "Remixes before a keep" },
  { counter: "swaps", label: "Swaps" },
  { counter: "checkins", label: "Check-ins" },
  { counter: "didntLand", label: "Didn’t land" },
  { counter: "shared", label: "Shares" },
  { counter: "youtubeUnits", label: "YouTube units" },
];

// Stats (C1): opens only for the Google account in STATS_EMAIL; for anyone else it doesn't exist.
export default async function Stats() {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  const guest = checkGuest(new Request("https://trailmix.local/stats", { headers: session ? { cookie: `${SESSION_COOKIE}=${encodeURIComponent(session)}` } : {} }));
  const allowed = config.statsEmail();
  if (!guest.ok || !allowed || guest.session.email.toLowerCase() !== allowed) notFound();

  const data = await statsData();
  return (
    <main className={`screen screen--sand ${styles.page}`}>
      <div className="top-bar">
        <span className="wordmark">Trailmix</span>
        <span className="mono">Stats</span>
      </div>
      <Headline text="How it’s going." size="screen" />

      <section aria-labelledby="measures">
        <h2 id="measures">Measures</h2>
        <div className={styles.scroll}>
          <table className={styles.table} data-testid="measures">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {data.periods.map((p) => (
                  <th scope="col" key={p.label}>
                    {p.label}
                  </th>
                ))}
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {MEASURES.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  {data.periods.map((p) => {
                    const v = m.value(p.totals);
                    return (
                      <td key={p.label} className={v === null ? styles.none : m.meets(v) ? styles.good : styles.bad}>
                        {v === null ? "–" : m.format(v)}
                        {v !== null && <span className="sr-only">{m.meets(v) ? " (meets target)" : " (misses target)"}</span>}
                      </td>
                    );
                  })}
                  <td>{m.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="checkpoints">
        <h2 id="checkpoints">Checkpoints (people)</h2>
        <CountTable rows={CHECKPOINTS} data={data} testId="checkpoints" />
      </section>

      <section aria-labelledby="counts">
        <h2 id="counts">Counts</h2>
        <CountTable rows={COUNTS} data={data} testId="counts" />
      </section>

      <p className="mono" data-testid="ceiling">
        Claude mixes today: {data.claudeToday} of {data.ceiling}
      </p>
      <p className={styles.note}>Anonymous daily counts, kept 90 days. UK days.</p>
    </main>
  );
}

function CountTable({ rows, data, testId }: { rows: { counter: Counter; label: string }[]; data: Awaited<ReturnType<typeof statsData>>; testId: string }) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} data-testid={testId}>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Count</span>
            </th>
            {data.periods.map((p) => (
              <th scope="col" key={p.label}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.counter}>
              <th scope="row">{r.label}</th>
              {data.periods.map((p) => (
                <td key={p.label}>{p.totals[r.counter].toLocaleString("en-GB")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
