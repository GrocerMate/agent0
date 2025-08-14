// app/page.tsx
"use client";
import React, { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || ""; // set in Vercel

type ExecResult =
  | { ok: true; url?: string }
  | { ok: false; needs_human?: boolean; blocked?: boolean; reason?: string; error?: string; domain_allowlist?: string[] };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const VNC_URL = "http://localhost:6080/vnc.html?host=localhost&port=6080";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ExecResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [apiBase, setApiBase] = useState(API_BASE);

  const addLog = (line: string) =>
    setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 200));

  const templates = useMemo(
    () => [
      `Open https://wikipedia.org and search for "Alan Turing", then open the first result.`,
      `Go to https://playwright.dev, search for "network request interception" and open the docs page.`,
      `Open https://news.ycombinator.com and click the top story.`,
    ],
    []
  );

  async function callExecute(p: string) {
    setLoading(true);
    setLastResult(null);
    addLog(`POST /execute  "${p}"`);
    try {
      const res = await fetch(`${apiBase}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data: ExecResult = await res.json();
      setLastResult(data);
      if ("ok" in data && data.ok) {
        addLog(`✅ Step complete${data.url ? ` — at ${data.url}` : ""}`);
        setHistory((h) => [p, ...h].slice(0, 50));
      } else {
        if ((data as any).blocked) {
          addLog(`⛔ Blocked by allowlist: ${(data as any).reason || ""}`);
        } else if ((data as any).needs_human) {
          addLog(`🖐 Needs human verification — complete it in the viewer, then click Continue.`);
        } else {
          addLog(`❌ Error: ${(data as any).error || (data as any).reason || "Unknown"}`);
        }
      }
    } catch (e: any) {
      addLog(`❌ Network error: ${e?.message || e}`);
      setLastResult({ ok: false, error: e?.message || "Network error" } as ExecResult);
    } finally {
      setLoading(false);
    }
  }

  const onRun = () => {
    if (!prompt.trim()) return;
    callExecute(prompt.trim());
  };

  const onTemplate = (t: string) => setPrompt(t);

  const statusBadge = (() => {
    if (!lastResult) return null;
    if (lastResult.ok) return <Badge color="#10b981">OK</Badge>;
    if (lastResult.needs_human) return <Badge color="#f59e0b">Needs human</Badge>;
    if (lastResult.blocked) return <Badge color="#ef4444">Blocked</Badge>;
    return <Badge color="#ef4444">Error</Badge>;
  })();

  return (
    <div style={styles.page}>
      {/* Left: Controls */}
      <div style={styles.left}>
        <h2 style={{ marginBottom: 8 }}>Agent Browser</h2>

        {/* Config */}
        <section style={styles.card}>
          <h3 style={styles.h3}>Settings</h3>
          <label style={styles.label}>
            Backend URL
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://localhost:5000"
              style={styles.input}
            />
          </label>
        </section>

        {/* Prompt */}
        <section style={styles.card}>
          <h3 style={styles.h3}>Prompt</h3>
          <textarea
            rows={6}
            style={styles.textarea}
            placeholder={`e.g. ${templates[0]}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRun} disabled={loading || !prompt.trim()} style={styles.buttonPrimary}>
              {loading ? "Running…" : "Run"}
            </button>
            <button
              onClick={() => setPrompt("")}
              disabled={loading}
              style={styles.button}
              title="Clear prompt"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Templates */}
        <section style={styles.card}>
          <h3 style={styles.h3}>Templates</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {templates.map((t, i) => (
              <button key={i} onClick={() => onTemplate(t)} disabled={loading} style={styles.buttonGhost}>
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* History */}
        <section style={styles.card}>
          <h3 style={styles.h3}>History</h3>
          {history.length === 0 ? (
            <div style={styles.muted}>No prompts yet</div>
          ) : (
            <ul style={styles.ul}>
              {history.map((h, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <button onClick={() => setPrompt(h)} style={styles.linkButton} title="Load prompt">
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right: Viewer + Results */}
      <div style={styles.right}>
        <section style={styles.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={styles.h3}>Live Viewer</h3>
            <div>{statusBadge}</div>
          </div>
          <iframe
            src={VNC_URL}
            width="100%"
            height="620"
            style={styles.iframe}
            title="Live AI Browser"
          />
          {!!lastResult && (
            <div style={{ marginTop: 8 }}>
              {lastResult.ok && lastResult.url && (
                <div style={styles.successBox}>
                  Agent step done — at <strong>{lastResult.url}</strong>
                </div>
              )}
              {!lastResult.ok && lastResult.needs_human && (
                <div style={styles.warnBox}>
                  CAPTCHA / bot wall detected — complete it in the viewer, then re-run your next step.
                </div>
              )}
              {!lastResult.ok && lastResult.blocked && (
                <div style={styles.errorBox}>
                  {lastResult.reason || "Blocked by allowlist."}
                  {lastResult.domain_allowlist && (
                    <div style={styles.muted}>(Allowed: {lastResult.domain_allowlist.join(", ")})</div>
                  )}
                </div>
              )}
              {!lastResult.ok && !lastResult.needs_human && !lastResult.blocked && (
                <div style={styles.errorBox}>{lastResult.error || "Something went wrong"}</div>
              )}
            </div>
          )}
        </section>

        {/* Logs */}
        <section style={styles.card}>
          <h3 style={styles.h3}>Logs</h3>
          <div style={styles.logBox}>
            {logs.length === 0 ? (
              <div style={styles.muted}>No logs yet</div>
            ) : (
              logs.map((l, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {l}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color,
        color: "#fff",
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gridTemplateColumns: "400px 1fr",
    gap: 16,
    padding: 16,
    minHeight: "100vh",
    background: "#0b0f17",
    color: "#e5e7eb",
  },
  left: {
    display: "grid",
    alignContent: "start",
    gap: 12,
  },
  right: {
    display: "grid",
    alignContent: "start",
    gap: 12,
  },
  card: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
    padding: 12,
  },
  h3: { margin: "0 0 8px", fontSize: 16 },
  label: { display: "grid", gap: 6, fontSize: 14 },
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #374151",
    background: "#0b1220",
    color: "#e5e7eb",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #374151",
    minHeight: 120,
    background: "#0b1220",
    color: "#e5e7eb",
    outline: "none",
    marginBottom: 8,
  },
  buttonPrimary: {
    padding: "8px 14px",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  button: {
    padding: "8px 14px",
    borderRadius: 8,
    background: "#374151",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },
  buttonGhost: {
    padding: "8px 10px",
    borderRadius: 8,
    background: "transparent",
    color: "#cbd5e1",
    border: "1px solid #334155",
    textAlign: "left",
    cursor: "pointer",
  },
  iframe: {
    border: "1px solid #1f2937",
    borderRadius: 8,
  },
  ul: { listStyle: "disc", paddingLeft: 16, margin: 0 },
  linkButton: {
    background: "transparent",
    color: "#93c5fd",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  muted: { color: "#94a3b8", fontSize: 13 },
  logBox: {
    maxHeight: 260,
    overflow: "auto",
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 8,
    padding: 10,
  },
  successBox: {
    marginTop: 6,
    padding: 10,
    background: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 8,
  },
  warnBox: {
    marginTop: 6,
    padding: 10,
    background: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 8,
  },
  errorBox: {
    marginTop: 6,
    padding: 10,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
  },
};
