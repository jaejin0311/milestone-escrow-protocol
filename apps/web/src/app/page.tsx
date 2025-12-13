"use client";

import { useEffect, useMemo, useState } from "react";

type Milestone = {
  i: number;
  amountEth: string;
  deadline: number;
  status: number;
  proofURI: string;
  reasonURI: string;
};

type Snapshot = {
  address: string;
  funded: boolean;
  totalAmountEth: string;
  client: string;
  provider: string;
  count: number;
  milestones: Milestone[];
};

type ApiState = {
  ok: boolean;
  rpc: string;
  factory: string;
  escrows: string[];
  selected: string | null;
  snapshot: Snapshot | null;
};

const statusLabel = (s: number) => ["Pending", "Submitted", "Approved", "Rejected", "Paid"][s] ?? `Unknown(${s})`;

function statusBadgeStyle(s: number): React.CSSProperties {
  const map: Record<number, React.CSSProperties> = {
    0: { background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" },
    1: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
    2: { background: "#ecfeff", color: "#155e75", borderColor: "#a5f3fc" },
    3: { background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" },
    4: { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
  };
  return map[s] ?? { background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
}

function trimAddr(addr?: string) {
  if (!addr) return "";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const [clientAddr, setClientAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
  const [providerAddr, setProviderAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
  const [amountsEthCsv, setAmountsEthCsv] = useState("0.001,0.002");
  const [deadlinesDaysCsv, setDeadlinesDaysCsv] = useState("7,14");
  const [state, setState] = useState<ApiState | null>(null);
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(0);
  const [escrowLimit, setEscrowLimit] = useState(20);
  const [proofURI, setProofURI] = useState("ipfs://proof-0");
  const [reasonURI, setReasonURI] = useState("ipfs://reason");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const selectedEscrow = state?.selected ?? null;
  const snap = state?.snapshot ?? null;

  const selectedMilestone = useMemo(() => {
    if (!snap) return null;
    return snap.milestones.find((m) => m.i === selectedMilestoneIdx) ?? null;
  }, [snap, selectedMilestoneIdx]);

  async function refresh(escrow?: string | null) {
    const params = new URLSearchParams();
    params.set("limit", String(escrowLimit));
    if (escrow) params.set("escrow", escrow);

    const qs = `?${params.toString()}`;
    const res = await fetch(`/api/escrow${qs}`, { cache: "no-store" });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      setState(data);
      // keep milestone idx valid
      const count = data?.snapshot?.milestones?.length ?? 0;
      if (count > 0 && selectedMilestoneIdx >= count) setSelectedMilestoneIdx(0);
    } catch {
      setLog(text || "(empty response)");
    }
  }

  async function post(action: string, payload: any = {}) {
    setBusy(true);
    try {
      setLog("...");
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const text = await res.text();
      try {
        setLog(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setLog(text || "(empty response)");
      }
    } finally {
      setBusy(false);
    }
  }

  async function createNewEscrow() {
    const amountsEth = amountsEthCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const days = deadlinesDaysCsv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    // convert days-from-now -> unix seconds
    const nowSec = Math.floor(Date.now() / 1000);
    const deadlinesSec = days.map((d) => nowSec + d * 24 * 60 * 60);

    await post("createEscrow", {
      client: clientAddr,
      provider: providerAddr,
      amountsEth,
      deadlinesSec,
    });

    await refresh(null);
  }

  async function act(action: string, payload: any = {}) {
    if (!selectedEscrow) return;
    await post(action, { escrow: selectedEscrow, ...payload });
    await refresh(selectedEscrow);
  }

  useEffect(() => {
    refresh(null).catch((e) => setLog(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrowLimit]);

  const canFund = !!snap && !snap.funded;
  const canSubmit =
    !!snap &&
    snap.funded &&
    !!selectedMilestone &&
    (selectedMilestone.status === 0 || selectedMilestone.status === 3);
  const canApprove = !!snap && snap.funded && !!selectedMilestone && selectedMilestone.status === 1;
  const canReject = !!snap && snap.funded && !!selectedMilestone && selectedMilestone.status === 1;

  const container: React.CSSProperties = {
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    maxWidth: 1100,
    margin: "0 auto",
    lineHeight: 1.4,
  };

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
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

  const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: "not-allowed" };

  const input: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
  };

  return (
    <main style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Milestone Escrow (Factory Demo)</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Factory creates new escrows. No env address swapping.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnGhost} onClick={() => refresh(selectedEscrow)} disabled={busy}>
            Refresh
          </button>
          <select
            value={escrowLimit}
            onChange={(e) => setEscrowLimit(Number(e.target.value))}
            style={{ ...input, width: 120 }}
            disabled={busy}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>


          <input
            style={{ ...input, width: 320 }}
            placeholder="client address"
            value={clientAddr}
            onChange={(e) => setClientAddr(e.target.value)}
          />
          <input
            style={{ ...input, width: 320 }}
            placeholder="provider address"
            value={providerAddr}
            onChange={(e) => setProviderAddr(e.target.value)}
          />
          <input
            style={{ ...input, width: 160 }}
            placeholder="amounts (ETH) e.g. 0.3,0.7"
            value={amountsEthCsv}
            onChange={(e) => setAmountsEthCsv(e.target.value)}
          />
          <input
            style={{ ...input, width: 140 }}
            placeholder="deadlines (days) e.g. 7,14"
            value={deadlinesDaysCsv}
            onChange={(e) => setDeadlinesDaysCsv(e.target.value)}
          />

          <button style={{ ...btn, ...(busy ? btnDisabled : {}) }} onClick={createNewEscrow} disabled={busy}>
            Create new escrow
          </button>
        </div>

      </div>

      <div style={{ height: 12 }} />

      <div style={grid}>
        <section style={card}>
          <div style={{ fontWeight: 800 }}>Escrows</div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
            Factory: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{state?.factory ?? "—"}</span>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: "grid", gap: 8 }}>
            {(state?.escrows ?? []).map((addr) => {
              const sel = addr === selectedEscrow;
              return (
                <button
                  key={addr}
                  onClick={() => refresh(addr)}
                  style={{
                    textAlign: "left",
                    border: "1px solid",
                    borderColor: sel ? "#111827" : "#e5e7eb",
                    background: sel ? "#f9fafb" : "#fff",
                    borderRadius: 12,
                    padding: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{trimAddr(addr)}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {addr}
                  </div>
                </button>
              );
            })}
            {!state?.escrows?.length ? (
              <div style={{ color: "#6b7280" }}>
                No escrows yet. Click <b>Create new escrow</b>.
              </div>
            ) : null}
          </div>
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800 }}>Selected Escrow</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>
                {selectedEscrow ? (
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{selectedEscrow}</span>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: snap?.funded ? "#f0fdf4" : "#fefce8",
                color: snap?.funded ? "#166534" : "#92400e",
                fontWeight: 800,
              }}
            >
              {snap ? (snap.funded ? "Funded" : "Not funded") : "No snapshot"}
            </div>
          </div>

          <div style={{ height: 12 }} />

          {snap ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Client</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{snap.client}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Provider</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{snap.provider}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
                  <div style={{ fontWeight: 800 }}>{snap.totalAmountEth} ETH</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Milestones</div>
                  <div style={{ fontWeight: 800 }}>{snap.count}</div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <button style={{ ...btn, ...(busy || !canFund ? btnDisabled : {}) }} disabled={busy || !canFund} onClick={() => act("fund")}>
                fund() as CLIENT
              </button>

              <div style={{ height: 14 }} />

              <div style={{ fontWeight: 800 }}>Milestones</div>
              <div style={{ height: 10 }} />

              <div style={{ display: "grid", gap: 8 }}>
                {snap.milestones.map((m) => {
                  const isSel = m.i === selectedMilestoneIdx;
                  return (
                    <button
                      key={m.i}
                      onClick={() => setSelectedMilestoneIdx(m.i)}
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
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontWeight: 900 }}>#{m.i}</span>
                          <span style={{ color: "#6b7280" }}>{m.amountEth} ETH</span>
                        </div>
                        <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid", fontWeight: 800, ...statusBadgeStyle(m.status) }}>
                          {statusLabel(m.status)}
                        </span>
                      </div>

                      <div style={{ height: 8 }} />

                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        proof: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{m.proofURI || "—"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        reason: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{m.reasonURI || "—"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ height: 14 }} />

              <div style={{ fontWeight: 800 }}>Actions (selected milestone #{selectedMilestoneIdx})</div>
              <div style={{ height: 10 }} />

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>submit</div>
                  <input style={input} value={proofURI} onChange={(e) => setProofURI(e.target.value)} />
                  <button style={{ ...btn, ...(busy || !canSubmit ? btnDisabled : {}) }} disabled={busy || !canSubmit} onClick={() => act("submit", { i: selectedMilestoneIdx, proofURI })}>
                    submit()
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>approve</div>
                  <div style={{ color: "#6b7280", display: "flex", alignItems: "center" }}>requires status = Submitted</div>
                  <button style={{ ...btn, ...(busy || !canApprove ? btnDisabled : {}) }} disabled={busy || !canApprove} onClick={() => act("approve", { i: selectedMilestoneIdx })}>
                    approve()
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>reject</div>
                  <input style={input} value={reasonURI} onChange={(e) => setReasonURI(e.target.value)} />
                  <button style={{ ...btnGhost, ...(busy || !canReject ? btnDisabled : {}) }} disabled={busy || !canReject} onClick={() => act("reject", { i: selectedMilestoneIdx, reasonURI })}>
                    reject()
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#6b7280" }}>Select an escrow or create a new one.</div>
          )}
        </section>
      </div>

      <div style={{ height: 12 }} />

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Log</div>
          <button style={btnGhost} onClick={() => setLog("")}>
            Clear
          </button>
        </div>
        <div style={{ height: 10 }} />
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#0b1020", color: "#c7f9cc", borderRadius: 12, padding: 12, minHeight: 120, fontSize: 13 }}>
          {log || "(no logs yet)"}
        </pre>
      </section>
    </main>
  );
}
