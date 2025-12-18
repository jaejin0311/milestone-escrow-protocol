"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createPublicClient, http, parseEventLogs } from "viem";
import { sepolia } from "viem/chains";
import { factoryAbi } from "@/lib/factoryAbi";

// --- Types ---
type EscrowMetadata = {
  address: string;
  title: string;
  client_address: string;
  provider_address: string;
  total_amount: string;
  created_at: string;
};

type Milestone = {
  i: number;
  amountEth: string;
  deadline: number;
  status: number;
  proofURI: string;
  reasonURI: string;
  submittedAt: number;
};

type Snapshot = {
  address: string;
  funded: boolean;
  totalAmountEth: string;
  client: string;
  provider: string;
  count: number;
  milestones: Milestone[];
  chainTime: number;
};

type ApiState = {
  ok: boolean;
  rpc: string;
  factory: string;
  escrows: string[];
  dbData?: EscrowMetadata[];
  selected: string | null;
  snapshot: Snapshot | null;
};

// --- Helpers ---
const statusLabel = (s: number) => ["Pending", "Submitted", "Approved", "Rejected", "Paid", "Claimed"][s] ?? `Unknown(${s})`;

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

function formatDuration(sec: number) {
  let s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.ceil(s / 60); 
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function trimAddr(addr?: string) {
  if (!addr) return "";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(isoString?: string) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
}

export default function Home() {
  const [clientAddr, setClientAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
  const [providerAddr, setProviderAddr] = useState("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const [amountsEthCsv, setAmountsEthCsv] = useState("0.0001,0.0002");
  const [deadlinesDaysCsv, setDeadlinesDaysCsv] = useState("7,14");
  const [titleInput, setTitleInput] = useState("");

  const [state, setState] = useState<ApiState | null>(null);
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(0);
  const [escrowLimit, setEscrowLimit] = useState(20);
  
  // Submit Form States
  const [descInput, setDescInput] = useState(""); 
  const [fileUrl, setFileUrl] = useState("");     
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Common Action States
  const [reasonURI, setReasonURI] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEscrow = state?.selected ?? null;
  const snap = state?.snapshot ?? null;
  const [fetchedAtMs, setFetchedAtMs] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const selectedMilestone = useMemo(() => {
    if (!snap) return null;
    return snap.milestones.find((m) => m.i === selectedMilestoneIdx) ?? null;
  }, [snap, selectedMilestoneIdx]);

  const isAllPaid = useMemo(() => {
    if (!snap || snap.milestones.length === 0) return false;
    return snap.milestones.every((m) => m.status === 4);
  }, [snap]);

  function getEscrowTitle(addr: string) {
    if (!state?.dbData) return null;
    const found = state.dbData.find((d) => d.address.toLowerCase() === addr.toLowerCase());
    return found?.title || null;
  }

  async function refresh(escrow?: string | null, opts?: { autoPick?: boolean }) {
    const params = new URLSearchParams();
    params.set("limit", String(escrowLimit));
    if (escrow) params.set("escrow", escrow);

    const qs = `?${params.toString()}`;
    const res = await fetch(`/api/escrow${qs}`, { cache: "no-store" });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      setFetchedAtMs(Date.now());
      setState(data);
      
      const ms = data?.snapshot?.milestones ?? [];
      if ((opts?.autoPick ?? false) && ms.length > 0) {
        const nextIdx = ms.find((x: any) => x.status === 0 || x.status === 3)?.i ?? 0;
        setSelectedMilestoneIdx(nextIdx);
      }
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
      setError(null);
      setNotice(null);
      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
        setLog(JSON.stringify(json, null, 2));
      } catch {
        setLog(text || "(empty response)");
      }
      if (!res.ok) {
        throw new Error(json?.error?.message || text || `HTTP ${res.status}`);
      }
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function createNewEscrow() {
    if (clientAddr.toLowerCase() === providerAddr.toLowerCase()) {
      setError("Client and Provider address must be different!");
      return;
    }

    const amountsEth = amountsEthCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const days = deadlinesDaysCsv.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    const nowSec = snap?.chainTime && fetchedAtMs
        ? snap.chainTime + Math.floor((Date.now() - fetchedAtMs) / 1000)
        : Math.floor(Date.now() / 1000);
    const deadlinesSec = days.map((d) => nowSec + d * 24 * 60 * 60);

    setBusy(true);
    setLog("Initiating transaction...");
    setError(null);

    try {
      // 1. Send Tx (Server)
      const out = await post("createEscrow", {
        client: clientAddr,
        provider: providerAddr,
        amountsEth,
        deadlinesSec,
      });
      console.log(`Error:`);

      if (!out?.hash) throw new Error("No tx hash returned");
      setLog(`Transaction sent: ${out.hash}\nWaiting for mining on Sepolia (may take 10-30s)...`);

      const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/92sSobiPIfaqB5IkAVkZC";
      const publicClient = createPublicClient({ 
        chain: sepolia, 
        transport: http(rpcUrl) 
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: out.hash });
      setLog(`Mined in block ${receipt.blockNumber}! Finding escrow address...`);

      // 3. Find Address
      const parsed = parseEventLogs({ 
        abi: factoryAbi, 
        logs: receipt.logs,
        eventName: 'EscrowCreated' 
      });
      const newEscrowAddr = (parsed[0] as any)?.args?.escrow;

      if (newEscrowAddr) {
        // 4. Save to DB (Server)
        console.log(`Deployed at ${newEscrowAddr}. Saving to database...`);
        await post("saveEscrow", {
          escrowAddress: newEscrowAddr,
          client: clientAddr,
          provider: providerAddr,
          amountsEth,
          title: titleInput || "Untitled Project"
        });
        
        setTitleInput(""); 
        await refresh(newEscrowAddr);
        setNotice("Success! Escrow created and saved.");
      } else {
        throw new Error("Could not parse EscrowCreated event.");
      }
    } catch (e: any) {
      setError(e.message || String(e));
      // setLog(`Error: ${e.message}`);
      // setLog(`Errorrrrr: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('proofs').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('proofs').getPublicUrl(filePath);
      setFileUrl(data.publicUrl);
      setLog(`File uploaded: ${data.publicUrl}`);
    } catch (err: any) {
      setError(err.message);
      setLog(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function act(action: string, payload: any = {}) {
    if (!selectedEscrow) return;
    // 1. 버튼 비활성화 (중복 클릭 방지)
    setBusy(true);
    setLog(`Initiating ${action}...`);
    setError(null);
    try {
      const res = await post(action, {escrow: selectedEscrow, ...payload});
      
      if(res.hash){
        setLog(`Tx sent: ${res.hash}\nWaiting for mining...`);

        const rpcUrl = "https://ethereum-sepolia.publicnode.com";
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        
        await publicClient.waitForTransactionReceipt({ hash: res.hash });
        setLog(`Transaction mined! Updating UI...`);
      }
      // 4. [핵심] 화면 강제 업데이트 (Optimistic Update)
      // refresh를 기다리지 않고, 우리가 아는 결과로 화면을 먼저 고칩니다.
      if (action === "fund") {
        setState((prev) => {
           if (!prev || !prev.snapshot) return prev;
           return {
             ...prev,
             snapshot: { 
               ...prev.snapshot, 
               funded: true // ✅ 강제로 'Funded' 상태로 변경 -> 버튼 사라짐
             } 
           };
        });
      }
      
      // submit 후 폼 초기화
      if (action === 'submit') {
          setIsResubmitting(false);
          setDescInput("");
          setFileUrl("");
      }
      if (action === 'reject') setReasonURI("");

      setNotice(`Success: ${action}`);
      
      // 5. 실제 데이터 새로고침 (확인 사살)
      await refresh(selectedEscrow);
      if (action === 'reject') setReasonURI("");
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  useEffect(() => {
    refresh(null).catch((e) => setLog(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrowLimit]);

  const m = selectedMilestone;
  const canFund = !!selectedEscrow && !busy && !!snap && !snap.funded;
  const nowSec = snap?.chainTime ?? Math.floor(Date.now() / 1000);
  const readyInSec = selectedMilestone ? Math.max(0, selectedMilestone.deadline - nowSec) : 0;

  const canClaim = !!selectedEscrow && !!snap?.funded && !!selectedMilestone && selectedMilestone.status === 1 && readyInSec === 0;
  const canSubmit = !!selectedEscrow && !!snap?.funded && !!m && (m.status === 0 || m.status === 3); 
  const canApprove = !!selectedEscrow && !!snap?.funded && !!m && m.status === 1; 
  const canReject = !!selectedEscrow && !!snap?.funded && !!m && m.status === 1;

  // --- Styles ---
  const container: React.CSSProperties = { padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial", maxWidth: 1100, margin: "0 auto", lineHeight: 1.4 };
  const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 };
  const btn: React.CSSProperties = { border: "1px solid #d1d5db", background: "#111827", color: "#fff", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
  const btnGhost: React.CSSProperties = { border: "1px solid #d1d5db", background: "#fff", color: "#111827", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
  const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: "not-allowed" };
  const input: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px", width: "100%" };
  const actionRowGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10, alignItems: "center" };

  return (
    <main style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Milestone Escrow (Factory Demo)</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Persisted via Supabase. Creates escrows on Sepolia.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnGhost} onClick={() => refresh(selectedEscrow)} disabled={busy}>Refresh</button>
          
          <div style={{display:'flex', gap:8, width:'100%', flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end', marginTop: 10}}>
            <input style={{ ...input, width: 240, borderColor: "#818cf8" }} placeholder="Project Title" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} />
            <input style={{ ...input, width: 200 }} placeholder="Client" value={clientAddr} onChange={(e) => setClientAddr(e.target.value)} />
            <input style={{ ...input, width: 200 }} placeholder="Provider" value={providerAddr} onChange={(e) => setProviderAddr(e.target.value)} />
            <input style={{ ...input, width: 100 }} placeholder="ETH" value={amountsEthCsv} onChange={(e) => setAmountsEthCsv(e.target.value)} />
            <input style={{ ...input, width: 80 }} placeholder="Days" value={deadlinesDaysCsv} onChange={(e) => setDeadlinesDaysCsv(e.target.value)} />
            <button style={{ ...btn, ...(busy ? btnDisabled : {}) }} onClick={createNewEscrow} disabled={busy}>Create Escrow</button>
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div style={grid}>
        <section style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight: 800 }}>My Escrows</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{state?.escrows?.length ?? 0} items</div>
          </div>
          <div style={{ height: 12 }} />
          <div style={{ display: "grid", gap: 8, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
            {(state?.escrows ?? []).map((addr) => {
              const sel = addr === selectedEscrow;
              const meta = state?.dbData?.find((d) => d.address.toLowerCase() === addr.toLowerCase());
              const title = meta?.title || "Untitled Project";
              const dateStr = formatDate(meta?.created_at);

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
                    padding: "12px 14px",
                    cursor: "pointer",
                    position: "relative"
                  }}
                >
                  {sel && <div style={{ position:'absolute', left:0, top:12, bottom:12, width:4, background:'#111827', borderTopRightRadius:4, borderBottomRightRadius:4 }} />}
                  <div style={{ fontWeight: 700, fontSize: 15, color: sel ? "#000" : "#374151", marginBottom: 4 }}>{title}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ color: "#9ca3af", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{trimAddr(addr)}</div>
                    <div style={{ fontSize: 11, color: "#d1d5db" }}>{dateStr}</div>
                  </div>
                </button>
              );
            })}
            {!state?.escrows?.length && <div style={{ color: "#9ca3af", textAlign:'center', padding: '40px 0', fontSize: 14 }}>No escrows found.</div>}
          </div>
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{getEscrowTitle(selectedEscrow || "") || "Selected Escrow"}</div>
              <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>{selectedEscrow ? <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{selectedEscrow}</span> : "Select an escrow from the list"}</div>
            </div>
            <div style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid", fontWeight: 800, fontSize: 13, ...(snap ? isAllPaid ? { background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" } : snap.funded ? { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" } : { background: "#fefce8", color: "#854d0e", borderColor: "#fde047" } : { background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }) }}>
              {snap ? (isAllPaid ? "✅ Completed" : snap.funded ? "🟢 Funded & Active" : "⚠️ Not Funded") : "Checking..."}
            </div>
          </div>

          <div style={{ height: 16 }} />

          {snap ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: '#f9fafb', padding: 12, borderRadius: 8 }}>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Client</div><div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{trimAddr(snap.client)}</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Provider</div><div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{trimAddr(snap.provider)}</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Total Amount</div><div style={{ fontWeight: 800 }}>{snap.totalAmountEth} ETH</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Progress</div><div style={{ fontWeight: 800 }}>{snap.milestones.filter(m=>m.status===4).length} / {snap.count} Paid</div></div>
              </div>
              <div style={{ height: 12 }} />
              {!snap.funded && <button style={{ ...btn, width:'100%', ...(busy || !canFund ? btnDisabled : {}) }} disabled={busy || !canFund} onClick={() => act("fund")}>💰 Fund this Escrow (Client Only)</button>}
              {isAllPaid && <div style={{ marginTop: 12, padding: "12px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 8, color: "#1e40af", fontSize: 14, textAlign:'center' }}>All milestones have been paid. This contract is fulfilled. 🏁</div>}
              <div style={{ height: 20 }} />
              <div style={{ fontWeight: 800, borderBottom:'1px solid #e5e7eb', paddingBottom: 8, marginBottom: 12 }}>Milestones</div>
              <div style={{ display: "grid", gap: 8 }}>
                {snap.milestones.map((m) => {
                  const isSel = m.i === selectedMilestoneIdx;
                  return (
                    <button key={m.i} onClick={() => setSelectedMilestoneIdx(m.i)} style={{ textAlign: "left", border: "1px solid", borderColor: isSel ? "#111827" : "#e5e7eb", background: isSel ? "#f9fafb" : "#fff", borderRadius: 12, padding: 12, cursor: "pointer", opacity: isAllPaid && !isSel ? 0.6 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontWeight: 900, background:'#e5e7eb', padding:'2px 8px', borderRadius: 4, fontSize: 12 }}>#{m.i}</span><span style={{ color: "#374151", fontWeight: 600 }}>{m.amountEth} ETH</span></div>
                        <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 700, ...statusBadgeStyle(m.status) }}>{statusLabel(m.status)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 20 }} />
              <div style={{background: '#f3f4f6', padding: 16, borderRadius: 12}}>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Milestone #{selectedMilestoneIdx} Details</div>
                  {selectedMilestone?.proofURI && (
                    <div style={{ background: "#eff6ff", padding: 16, borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 20 }}>
                        <div style={{ fontWeight: 800, color: "#1e40af", marginBottom: 8, display:'flex', justifyContent:'space-between' }}>
                        <span>📂 Submitted Proof</span>
                        <a href={selectedMilestone.proofURI.split('|').pop()?.trim()} target="_blank" rel="noreferrer" style={{ fontSize: 13, textDecoration: 'underline', color: '#2563eb', cursor: 'pointer' }}>Open Original ↗</a>
                        </div>
                        {selectedMilestone.proofURI.includes('|') && <div style={{marginBottom: 10, fontSize: 14, color:'#1e3a8a', whiteSpace:'pre-wrap'}}>{selectedMilestone.proofURI.split('|')[0].trim()}</div>}
                        {isImage(selectedMilestone.proofURI) ? <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #dbeafe' }}><img src={selectedMilestone.proofURI.split('|').pop()?.trim()} alt="Proof" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#fff' }} /></div> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: 12, borderRadius: 8, marginTop: 8 }}><div style={{ fontSize: 24 }}>📄</div><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: '#4b5563' }}>{selectedMilestone.proofURI.split('|').pop()?.trim()}</div></div>}
                    </div>
                  )}
                  {!isAllPaid && selectedMilestone?.status !== 4 && (
                      <div style={{ display: "grid", gap: 10 }}>
                        {selectedMilestone && selectedMilestone.status === 1 && !isResubmitting ? (
                          <div style={{ ...actionRowGrid, alignItems: 'center' }}>
                            <div style={{ color: "#6b7280" }}>submit</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa', padding: '10px 14px', borderRadius: 10, color: '#9a3412', fontSize: 14, fontWeight: 600 }}><span>✅ Submitted</span><span style={{ fontSize: 12, fontWeight: 400, color: '#c2410c' }}>Waiting approval</span></div>
                            <button style={{ ...btnGhost, fontSize: 13, padding: '8px 12px' }} onClick={() => setIsResubmitting(true)}>Edit / Resubmit</button>
                          </div>
                        ) : (
                          <div style={{ ...actionRowGrid, alignItems: 'start' }}>
                            <div style={{ display: "flex", alignItems: "center", height: 38, color: "#6b7280" }}>{isResubmitting ? "re-submit" : "submit"}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <textarea style={{ ...input, fontFamily: 'inherit', resize: 'vertical', minHeight: 60 }} placeholder="Description..." value={descInput} onChange={(e) => setDescInput(e.target.value)} disabled={uploading} />
                              {fileUrl ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}><div style={{ display:'flex', alignItems:'center', gap: 6, overflow:'hidden' }}><span>📎</span><a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration:'underline', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 180 }}>{fileUrl.split('/').pop()}</a></div><button onClick={() => setFileUrl("")} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 800 }}>✕</button></div> : <div style={{ display:'flex', alignItems:'center', gap: 8 }}><label style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, cursor: uploading ? 'wait' : 'pointer', background: uploading ? '#f3f4f6' : '#fff' }}><span>📤</span><span>{uploading ? "Uploading..." : "Attach File"}</span><input type="file" disabled={busy || uploading} onChange={handleFileUpload} style={{ display: 'none' }} /></label><span style={{ fontSize: 12, color: '#9ca3af' }}>No file chosen</span></div>}
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap: 6, height: '100%' }}>
                              <button
                                style={{ ...btn, height: '100%', ...(busy || uploading || !canSubmit || (!descInput && !fileUrl) ? btnDisabled : {}) }}
                                disabled={busy || uploading || !canSubmit || (!descInput && !fileUrl)}
                                onClick={() => {
                                  const finalProof = descInput && fileUrl ? `${descInput} | ${fileUrl}` : descInput || fileUrl;
                                  act("submit", { i: selectedMilestoneIdx, proofURI: finalProof }).then(() => setIsResubmitting(false));
                                }}
                              >
                                {uploading ? 'Wait...' : 'Submit'}
                              </button>
                              {isResubmitting && <button style={{ ...btnGhost, padding: 6, fontSize: 12 }} onClick={() => setIsResubmitting(false)}>Cancel</button>}
                            </div>
                          </div>
                        )}
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>approve</div><div style={{ color: "#6b7280", fontSize: 13 }}>requires status = Submitted</div><button style={{ ...btn, ...(busy || !canApprove ? btnDisabled : {}) }} disabled={busy || !canApprove} onClick={() => act("approve", { i: selectedMilestoneIdx })}>approve()</button></div>
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>reject</div><input style={input} value={reasonURI} onChange={(e) => setReasonURI(e.target.value)} placeholder="reason" /><button style={{ ...btnGhost, ...(busy || !canReject ? btnDisabled : {}) }} disabled={busy || !canReject} onClick={() => act("reject", { i: selectedMilestoneIdx, reasonURI })}>reject()</button></div>
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>claim</div><div style={{ color: "#6b7280", fontSize: 13 }}>{selectedMilestone?.status === 0 || selectedMilestone?.status === 3 ? "submit first" : selectedMilestone?.status === 1 ? (readyInSec === 0 ? "ready" : `ready in ${formatDuration(readyInSec)}`) : "not claimable"}</div><button style={{ ...btn, ...(busy || !canClaim ? btnDisabled : {}) }} disabled={busy || !canClaim} onClick={() => act("claim", { i: selectedMilestoneIdx })}>claim()</button></div>
                      </div>
                  )}
                  {selectedMilestone?.status === 4 && <div style={{ padding: 20, textAlign: 'center', color: '#166534', background:'#f0fdf4', borderRadius:8 }}>🎉 Payment Complete for Milestone #{selectedMilestoneIdx}</div>}
              </div>
            </>
          ) : (
            <div style={{ color: "#6b7280", textAlign:'center', marginTop: 40 }}>Select a project from the left list.</div>
          )}
        </section>
      </div>

      <div style={{ height: 12 }} />
      {error && <section style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}><div style={{ fontWeight: 800 }}>Error</div><div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "ui-monospace" }}>{error}</div></section>}
      {notice && <section style={{ ...card, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", marginTop:12 }}><div style={{ fontWeight: 800 }}>Success</div><div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "ui-monospace" }}>{notice}</div></section>}
      <div style={{ height: 12 }} />
      <section style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div style={{ fontWeight: 800 }}>Log</div><button style={btnGhost} onClick={() => setLog("")}>Clear</button></div><div style={{ height: 10 }} /><pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#0b1020", color: "#c7f9cc", borderRadius: 12, padding: 12, minHeight: 120, fontSize: 13 }}>{log || "(no logs yet)"}</pre></section>
    </main>
  );
}