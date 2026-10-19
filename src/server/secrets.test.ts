// @vitest-environment node
// N5: no real key anywhere in the repository. Test files use obviously fake keys on purpose.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS: [string, RegExp][] = [
  ["Anthropic key", /sk-ant-(api|admin)\d\d-[A-Za-z0-9_-]{20,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Google OAuth client secret", /GOCSPX-[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["Upstash token", /"?(UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN)"?\s*[:=]\s*"?[A-Za-z0-9=_-]{20,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

describe("N5: secret scan", () => {
  const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !/\.(png|ico|ttf|woff2?)$/.test(f));

  it("checks every file that would be committed", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).not.toContain(".env.local");
    expect(files.some((f) => /client_secret.*\.json$|token\.json$/.test(f))).toBe(false);
  });

  it("finds no real keys", () => {
    const hits: string[] = [];
    for (const f of files) {
      let text = "";
      try {
        text = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      for (const [name, re] of PATTERNS) if (re.test(text)) hits.push(`${name} in ${f}`);
    }
    expect(hits).toEqual([]);
  });
});
