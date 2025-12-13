"use client";

import { useEffect, useState } from "react";
import { statusLabel } from "@/lib/escrowAbi";

type State = any;

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [log, setLog] = useState("");
  const [i, setI] = useState(0);
  const [proofURI, setProofURI] = useState("ipfs://proof-0");
  const [reasonURI, setReasonURI] = useState("ipfs://reason");

  async function refresh() {
    const res = await fetch("/api/escrow", { cache: "no-store" });
    const data = await res.json();
    setState(data);
  }

  async function act(action: string, payload: any = {}) {
    try {
      setLog("...");
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      setLog(JSON.stringify(data, null, 2));
      await refresh();
    } catch (e: any) {
      setLog(e?.message || String(e));
    }
  }

  useEffect(() => { refresh().catch((e) => setLog(String(e))); }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <h1>Milestone Escrow (Anvil in Codespaces)</h1>

      <button onClick={refresh}>Refresh</button>

      <pre style={{ background: "#f6f6f6", padding: 12, whiteSpace: "pre-wrap" }}>
        {state ? JSON.stringify({
          address: state.address,
          funded: state.funded,
          totalAmountEth: state.totalAmountEth,
          client: state.client,
          provider: state.provider
        }, null, 2) : "loading..."}
      </pre>

      <h3>Milestones</h3>
      {state?.milestones?.map((m: any) => (
        <div key={m.i} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 8 }}>
          <div><b>i</b>: {m.i}</div>
          <div><b>amount</b>: {m.amountEth} ETH</div>
          <div><b>status</b>: {statusLabel(m.status)}</div>
          <div><b>proof</b>: {m.proofURI}</div>
          <div><b>reason</b>: {m.reasonURI}</div>
        </div>
      ))}

      <hr />

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={() => act("fund")}>fund() as CLIENT (pk0)</button>

        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={i} min={0} onChange={(e) => setI(Number(e.target.value))} />
          <input style={{ flex: 1 }} value={proofURI} onChange={(e) => setProofURI(e.target.value)} />
          <button onClick={() => act("submit", { i, proofURI })}>submit(i, proofURI) as PROVIDER (pk1)</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={i} min={0} onChange={(e) => setI(Number(e.target.value))} />
          <button onClick={() => act("approve", { i })}>approve(i) as CLIENT (pk0)</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={i} min={0} onChange={(e) => setI(Number(e.target.value))} />
          <input style={{ flex: 1 }} value={reasonURI} onChange={(e) => setReasonURI(e.target.value)} />
          <button onClick={() => act("reject", { i, reasonURI })}>reject(i, reasonURI) as CLIENT (pk0)</button>
        </div>
      </div>

      <hr />
      <pre style={{ background: "#111", color: "#0f0", padding: 12, whiteSpace: "pre-wrap" }}>{log}</pre>
    </main>
  );
}
