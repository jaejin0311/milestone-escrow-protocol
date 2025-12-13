"use client";

import { useEffect, useMemo, useState } from "react";

type ApiState = {
  ok: boolean;
  address: string;
  rpc: string;
  client: string;
  provider: string;
  funded: boolean;
  totalAmountEth: string;
  count: number;
  milestones: {
    i: number;
    amountEth: string;
    deadline: number;
    status: number;
    proofURI: string;
    reasonURI: string;
  }[];
};

const statusLabel = (s: number) =>
  ["Pending", "Submitted", "Approved", "Rejected", "Paid"][s] ?? `Unknown(${s})`;

function statusBadgeStyle(s: number) {
  // Pending, Submitted, Approved, Rejected, Paid
  const map: Record<number, React.CSSProperties> = {
    0: { background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" },
    1: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
    2: { background: "#ecfeff", color: "#155e75", borderColor: "#a5f3fc" },
    3: { background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" },
    4: { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
  };
  return map[s] ?? { background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
}

function monospaceTrim(addr?: string) {
  if (!addr) return "";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const [state, setState] = useState<ApiState | null>(null);
  const [selected, setSelected] = useState<number>(0);

  const [proofURI, setProofURI] = useState("ipfs://proof-0");
  const [reasonURI, setReasonURI] = useState("ipfs://reason");

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  const selectedMilestone = useMemo(() => {
    if (!state) return null;
    return state.milestones?.find((m) => m.i === selected) ?? null;
  }, [state, selected]);

  async function refresh() {
    const res = await fetch("/api/escrow", { cache: "no-store" });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      setState(data);
      if (typeof data?.milestones?.length === "number" && data.milestones.length > 0) {
        if (!data.milestones.some((m: any) => m.i === selected)) setSelected(0);
      }
    } catch {
      setLog(text || "(empty response)");
    }
  }

  async function act(action: string, payload: any = {}) {
    try {
      setBusy(true);
      setLog("...");
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setLog(JSON.stringify(data, null, 2));
      } catch {
        setLog(text || "(empty response)");
      }

      await refresh();
    } catch (e: any) {
      setLog(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setLog(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canFund = !!state && !state.funded;
  const canSubmit =
    !!state &&
    state.funded &&
    !!selectedMilestone &&
    (selectedMilestone.status === 0 || selectedMilestone.status === 3); // Pending or Rejected
  const canApprove = !!state && state.funded && !!selectedMilestone && selectedMilestone.status === 1; // Submitted
  const canReject = !!state && state.funded && !!selectedMilestone && selectedMilestone.status === 1; // Submitted

  const container: React.CSSProperties = {
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    maxWidth: 1050,
    margin: "0 auto",
    lineHeight: 1.4,
  };

  const row: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" };

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const btn: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#111827",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
  };

  const btnGhost: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
  };

  const btnDisabled: React.CSSProperties = {
    opacity: 0.5,
    cursor: "not-allowed",
  };

  const input: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
  };

  return (
    <main style={container}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Milestone Escrow</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Anvil in Codespaces. Server signs tx (demo).
          </div>
        </div>

        <div style={row}>
          <button style={btnGhost} onClick={refresh} disabled={busy}>
            Refresh
          </button>
          <button style={{ ...btnGhost, ...(showRaw ? {} : {}) }} onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? "Hide raw" : "Show raw"}
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={grid}>
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Escrow</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>
                {state?.address ? (
                  <>
                    <span title={state.address}>{monospaceTrim(state.address)}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#9ca3af" }}>{state.address}</span>
                  </>
                ) : (
                  "loading..."
                )}
              </div>
            </div>

            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: state?.funded ? "#f0fdf4" : "#fefce8",
                color: state?.funded ? "#166534" : "#92400e",
                height: "fit-content",
                fontWeight: 700,
              }}
            >
              {state?.funded ? "Funded" : "Not funded"}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Client</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {state?.client ?? "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Provider</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {state?.provider ?? "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
              <div style={{ fontWeight: 700 }}>{state?.totalAmountEth ?? "—"} ETH</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Milestones</div>
              <div style={{ fontWeight: 700 }}>{state?.count ?? "—"}</div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row}>
            <button
              style={{ ...btn, ...(busy || !canFund ? btnDisabled : {}) }}
              disabled={busy || !canFund}
              onClick={() => act("fund")}
              title={state?.funded ? "Already funded" : "Fund escrow with total amount"}
            >
              fund() as CLIENT
            </button>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Tip: funded가 true면 fund는 실패가 정상.
            </div>
          </div>
        </section>

        <section style={card}>
          <div style={{ fontWeight: 700 }}>Selected milestone</div>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            index {selected} {selectedMilestone ? `• ${selectedMilestone.amountEth} ETH` : ""}
          </div>

          <div style={{ height: 12 }} />

          {selectedMilestone ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid",
                    fontWeight: 700,
                    ...statusBadgeStyle(selectedMilestone.status),
                  }}
                >
                  {statusLabel(selectedMilestone.status)}
                </span>
                <span style={{ color: "#6b7280", fontSize: 13 }}>
                  deadline: {selectedMilestone.deadline}
                </span>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>proofURI</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {selectedMilestone.proofURI || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>reasonURI</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {selectedMilestone.reasonURI || "—"}
                </div>
              </div>

              <div style={{ height: 6 }} />

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>submit</div>
                  <input style={input} value={proofURI} onChange={(e) => setProofURI(e.target.value)} />
                  <button
                    style={{ ...btn, ...(busy || !canSubmit ? btnDisabled : {}) }}
                    disabled={busy || !canSubmit}
                    onClick={() => act("submit", { i: selected, proofURI })}
                    title={!state?.funded ? "Not funded" : "Provider submits proof for milestone"}
                  >
                    submit()
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>approve</div>
                  <div style={{ color: "#6b7280", display: "flex", alignItems: "center" }}>
                    requires status = Submitted
                  </div>
                  <button
                    style={{ ...btn, ...(busy || !canApprove ? btnDisabled : {}) }}
                    disabled={busy || !canApprove}
                    onClick={() => act("approve", { i: selected })}
                  >
                    approve()
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>reject</div>
                  <input style={input} value={reasonURI} onChange={(e) => setReasonURI(e.target.value)} />
                  <button
                    style={{ ...btnGhost, ...(busy || !canReject ? btnDisabled : {}) }}
                    disabled={busy || !canReject}
                    onClick={() => act("reject", { i: selected, reasonURI })}
                  >
                    reject()
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>No milestone selected.</div>
          )}
        </section>
      </div>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Milestones</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>클릭해서 선택하면 오른쪽 액션이 그 index로 동작</div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gap: 8 }}>
          {state?.milestones?.map((m) => {
            const isSel = m.i === selected;
            return (
              <button
                key={m.i}
                onClick={() => setSelected(m.i)}
                style={{
                  textAlign: "left",
                  border: "1px solid",
                  borderColor: isSel ? "#111827" : "#e5e7eb",
                  background: isSel ? "#f9fafb" : "#fff",
                  borderRadius: 12,
                  padding: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontWeight: 800 }}>#{m.i}</span>
                    <span style={{ color: "#6b7280" }}>{m.amountEth} ETH</span>
                  </div>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid",
                      fontWeight: 700,
                      ...statusBadgeStyle(m.status),
                    }}
                  >
                    {statusLabel(m.status)}
                  </span>
                </div>

                <div style={{ height: 8 }} />

                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  proof: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{m.proofURI || "—"}</span>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  reason: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{m.reasonURI || "—"}</span>
                </div>
              </button>
            );
          })}
          {!state?.milestones?.length ? <div style={{ color: "#6b7280" }}>loading...</div> : null}
        </div>
      </section>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Log</div>
          <button style={btnGhost} onClick={() => setLog("")}>
            Clear
          </button>
        </div>

        <div style={{ height: 10 }} />

        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            background: "#0b1020",
            color: "#c7f9cc",
            borderRadius: 12,
            padding: 12,
            minHeight: 120,
            fontSize: 13,
            overflowX: "auto",
          }}
        >
          {log || "(no logs yet)"}
        </pre>

        {showRaw && (
          <>
            <div style={{ height: 12 }} />
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Raw API snapshot</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 12 }}>
              {state ? JSON.stringify(state, null, 2) : "loading..."}
            </pre>
          </>
        )}
      </section>
    </main>
  );
}
