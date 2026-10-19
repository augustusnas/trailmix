"use client";

import { useId, useState } from "react";
import { tryAccessCode } from "@/lib/access";
import styles from "./AccessCodeForm.module.css";

/** Asks once for the beta access code. MILESTONE 4: replaced by Google sign-in. */
export function AccessCodeForm({ onDone, tone = "dark" }: { onDone: () => void; tone?: "dark" | "light" }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMessage("");
    const res = await tryAccessCode(code);
    setBusy(false);
    if (res.ok) onDone();
    else setMessage(res.message);
  };

  return (
    <form className={`${styles.form} ${tone === "light" ? styles.light : ""}`} onSubmit={submit} data-testid="access-form">
      <label htmlFor={id} className="mono" style={{ letterSpacing: "0.14em" }}>
        Beta access code
      </label>
      <input
        id={id}
        className={styles.input}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={100}
        aria-describedby={`${id}-msg`}
      />
      <p id={`${id}-msg`} className={styles.message} role="status" aria-live="polite">
        {message}
      </p>
      <button type="submit" className="cta cta--large" disabled={busy} style={{ background: "var(--ink)", color: "var(--lime)" }}>
        <span>{busy ? "Checking…" : "Let me in"}</span>
      </button>
    </form>
  );
}
