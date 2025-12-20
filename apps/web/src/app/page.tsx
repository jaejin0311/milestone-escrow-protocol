"use client";

import EscrowList from "../components/escrow/MyEscrowList";
import { EscrowProvider, useEscrowStore } from "@/components/escrow/store";
import { useEscrow } from "@/hooks/useEscrow"
import MileStoneDetails from "@/components/milestone/MilestoneDetail";

function HomeInner() {
  const s = useEscrowStore();
  const {
    refresh,
    createNewEscrow,
  } = useEscrow();

  // --- Styles ---
  const container: React.CSSProperties = { padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial", maxWidth: 1100, margin: "0 auto", lineHeight: 1.4 };
  const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 };
  const btn: React.CSSProperties = { border: "1px solid #d1d5db", background: "#111827", color: "#fff", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
  const btnGhost: React.CSSProperties = { border: "1px solid #d1d5db", background: "#fff", color: "#111827", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
  const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: "not-allowed" };
  const input: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px", width: "100%" };

  return (
    <main style={container}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Milestone Escrow (Factory Demo)</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>Persisted via Supabase. Creates escrows on Sepolia.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnGhost} onClick={() => refresh(s.selectedEscrow)} disabled={s.busy}>Refresh</button>

          <div style={{ display: "flex", gap: 8, width: "100%", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", marginTop: 10 }}>
            <input style={{ ...input, width: 240, borderColor: "#818cf8" }} placeholder="Project Title" value={s.titleInput} onChange={(e) => s.setTitleInput(e.target.value)} />
            <input style={{ ...input, width: 200 }} placeholder="Client" value={s.clientAddr} onChange={(e) => s.setClientAddr(e.target.value)} />
            <input style={{ ...input, width: 200 }} placeholder="Provider" value={s.providerAddr} onChange={(e) => s.setProviderAddr(e.target.value)} />
            <input style={{ ...input, width: 100 }} placeholder="ETH" value={s.amountsEthCsv} onChange={(e) => s.setAmountsEthCsv(e.target.value)} />
            <input style={{ ...input, width: 80 }} placeholder="Days" value={s.deadlinesDaysCsv} onChange={(e) => s.setDeadlinesDaysCsv(e.target.value)} />
            <button style={{ ...btn, ...(s.busy ? btnDisabled : {}) }} onClick={createNewEscrow} disabled={s.busy}>Create Escrow</button>
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div style={grid}>
        {/* EscrowList */}
        <EscrowList
          escrows={s.state?.escrows ?? []}
          dbData={s.state?.dbData}
          selectedEscrow={s.selectedEscrow}
          onSelect={(addr) => refresh(addr)}
        />
        {/* MileStoneDetails */}
        <EscrowProvider>
          <MileStoneDetails />
        </EscrowProvider>

      </div>

      {/* logs */}
      <div style={{ height: 12 }} />
      {s.error && <section style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}><div style={{ fontWeight: 800 }}>Error</div><div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "ui-monospace" }}>{s.error}</div></section>}
      {s.notice && <section style={{ ...card, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", marginTop: 12 }}><div style={{ fontWeight: 800 }}>Success</div><div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "ui-monospace" }}>{s.notice}</div></section>}
      <div style={{ height: 12 }} />
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Log</div>
          <button style={btnGhost} onClick={() => s.setLog("")}>Clear</button>
        </div>
        <div style={{ height: 10 }} />
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#0b1020", color: "#c7f9cc", borderRadius: 12, padding: 12, minHeight: 120, fontSize: 13 }}>
          {s.log || "(no logs yet)"}
        </pre>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <EscrowProvider>
      <HomeInner />
    </EscrowProvider>
  );
}