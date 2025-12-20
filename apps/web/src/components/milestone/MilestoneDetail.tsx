"use client";

import React from "react";
import { trimAddr, isImage, formatDuration, statusBadgeStyle, statusLabel } from "../../app/utils/format";
import { useEscrowStore } from "@/components/escrow/store";
import { useEscrow } from "@/hooks/useEscrow"

export default function MileStoneDetails() {
  // 스타일 정의
    const s = useEscrowStore();
    const {
        getEscrowTitle,
        act,
        handleFileUpload,
        readyInSec,
        canFund,
        canSubmit,
        canApprove,
        canReject,
        canClaim,
    } = useEscrow();
    // --- Styles ---
    const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
    const btn: React.CSSProperties = { border: "1px solid #d1d5db", background: "#111827", color: "#fff", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
    const btnGhost: React.CSSProperties = { border: "1px solid #d1d5db", background: "#fff", color: "#111827", padding: "10px 12px", borderRadius: 10, cursor: "pointer" };
    const btnDisabled: React.CSSProperties = { opacity: 0.5, cursor: "not-allowed" };
    const input: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px", width: "100%" };
    const actionRowGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr 170px", gap: 10, alignItems: "center" };
    return (
        <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{getEscrowTitle(s.selectedEscrow || "") || "Selected Escrow"}</div>
                <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>{s.selectedEscrow ? <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{s.selectedEscrow}</span> : "Select an escrow from the list"}</div>
            </div>
            <div style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid", fontWeight: 800, fontSize: 13, ...(s.snap ? s.isAllPaid ? { background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" } : s.snap.funded ? { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" } : { background: "#fefce8", color: "#854d0e", borderColor: "#fde047" } : { background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }) }}>
                {s.snap ? (s.isAllPaid ? "✅ Completed" : s.snap.funded ? "🟢 Funded & Active" : "⚠️ Not Funded") : "Checking..."}
            </div>
            </div>

            <div style={{ height: 16 }} />

            {s.snap ? (
            <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: '#f9fafb', padding: 12, borderRadius: 8 }}>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Client</div><div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{trimAddr(s.snap.client)}</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Provider</div><div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{trimAddr(s.snap.provider)}</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Total Amount</div><div style={{ fontWeight: 800 }}>{s.snap.totalAmountEth} ETH</div></div>
                <div><div style={{ fontSize: 12, color: "#6b7280" }}>Progress</div><div style={{ fontWeight: 800 }}>{s.snap.milestones.filter(m=>m.status===4).length} / {s.snap.count} Paid</div></div>
                </div>
                <div style={{ height: 12 }} />
                {!s.snap.funded && <button style={{ ...btn, width:'100%', ...(s.busy || !canFund ? btnDisabled : {}) }} disabled={s.busy || !canFund} onClick={() => act("fund")}>💰 Fund this Escrow (Client Only)</button>}
                {s.isAllPaid && <div style={{ marginTop: 12, padding: "12px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 8, color: "#1e40af", fontSize: 14, textAlign:'center' }}>All milestones have been paid. This contract is fulfilled. 🏁</div>}
                <div style={{ height: 20 }} />
                <div style={{ fontWeight: 800, borderBottom:'1px solid #e5e7eb', paddingBottom: 8, marginBottom: 12 }}>Milestones</div>
                <div style={{ display: "grid", gap: 8 }}>
                {s.snap.milestones.map((m) => {
                    const isSel = m.i === s.selectedMilestoneIdx;
                    return (
                    <button key={m.i} onClick={() => s.setSelectedMilestoneIdx(m.i)} style={{ textAlign: "left", border: "1px solid", borderColor: isSel ? "#111827" : "#e5e7eb", background: isSel ? "#f9fafb" : "#fff", borderRadius: 12, padding: 12, cursor: "pointer", opacity: s.isAllPaid && !isSel ? 0.6 : 1 }}>
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
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Milestone #{s.selectedMilestoneIdx} Details</div>
                    {s.selectedMilestone?.proofURI && (
                    <div style={{ background: "#eff6ff", padding: 16, borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 20 }}>
                        <div style={{ fontWeight: 800, color: "#1e40af", marginBottom: 8, display:'flex', justifyContent:'space-between' }}>
                        <span>📂 Submitted Proof</span>
                        <a href={s.selectedMilestone.proofURI.split('|').pop()?.trim()} target="_blank" rel="noreferrer" style={{ fontSize: 13, textDecoration: 'underline', color: '#2563eb', cursor: 'pointer' }}>Open Original ↗</a>
                        </div>
                        {s.selectedMilestone.proofURI.includes('|') && <div style={{marginBottom: 10, fontSize: 14, color:'#1e3a8a', whiteSpace:'pre-wrap'}}>{s.selectedMilestone.proofURI.split('|')[0].trim()}</div>}
                        {isImage(s.selectedMilestone.proofURI) ? <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #dbeafe' }}><img src={s.selectedMilestone.proofURI.split('|').pop()?.trim()} alt="Proof" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#fff' }} /></div> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: 12, borderRadius: 8, marginTop: 8 }}><div style={{ fontSize: 24 }}>📄</div><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: '#4b5563' }}>{s.selectedMilestone.proofURI.split('|').pop()?.trim()}</div></div>}
                    </div>
                    )}
                    {!s.isAllPaid && s.selectedMilestone?.status !== 4 && (
                        <div style={{ display: "grid", gap: 10 }}>
                        {s.selectedMilestone && s.selectedMilestone.status === 1 && !s.isResubmitting ? (
                            <div style={{ ...actionRowGrid, alignItems: 'center' }}>
                            <div style={{ color: "#6b7280" }}>submit</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa', padding: '10px 14px', borderRadius: 10, color: '#9a3412', fontSize: 14, fontWeight: 600 }}><span>✅ Submitted</span><span style={{ fontSize: 12, fontWeight: 400, color: '#c2410c' }}>Waiting approval</span></div>
                            <button style={{ ...btnGhost, fontSize: 13, padding: '8px 12px' }} onClick={() => s.setIsResubmitting(true)}>Edit / Resubmit</button>
                            </div>
                        ) : (
                            <div style={{ ...actionRowGrid, alignItems: 'start' }}>
                            <div style={{ display: "flex", alignItems: "center", height: 38, color: "#6b7280" }}>{s.isResubmitting ? "re-submit" : "submit"}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <textarea style={{ ...input, fontFamily: 'inherit', resize: 'vertical', minHeight: 60 }} placeholder="Description..." value={s.descInput} onChange={(e) => s.setDescInput(e.target.value)} disabled={s.uploading} />
                                {s.fileUrl ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}><div style={{ display:'flex', alignItems:'center', gap: 6, overflow:'hidden' }}><span>📎</span><a href={s.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration:'underline', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 180 }}>{s.fileUrl.split('/').pop()}</a></div><button onClick={() => s.setFileUrl("")} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontWeight: 800 }}>✕</button></div> : <div style={{ display:'flex', alignItems:'center', gap: 8 }}><label style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, cursor: s.uploading ? 'wait' : 'pointer', background: s.uploading ? '#f3f4f6' : '#fff' }}><span>📤</span><span>{s.uploading ? "Uploading..." : "Attach File"}</span><input type="file" disabled={s.busy || s.uploading} onChange={handleFileUpload} style={{ display: 'none' }} /></label><span style={{ fontSize: 12, color: '#9ca3af' }}>No file chosen</span></div>}
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap: 6, height: '100%' }}>
                                <button
                                style={{ ...btn, height: '100%', ...(s.busy || s.uploading || !canSubmit || (!s.descInput && !s.fileUrl) ? btnDisabled : {}) }}
                                disabled={s.busy || s.uploading || !canSubmit || (!s.descInput && !s.fileUrl)}
                                onClick={() => {
                                    const finalProof = s.descInput && s.fileUrl ? `${s.descInput} | ${s.fileUrl}` : s.descInput || s.fileUrl;
                                    act("submit", { i: s.selectedMilestoneIdx, proofURI: finalProof }).then(() => s.setIsResubmitting(false));
                                }}
                                >
                                {s.uploading ? 'Wait...' : 'Submit'}
                                </button>
                                {s.isResubmitting && <button style={{ ...btnGhost, padding: 6, fontSize: 12 }} onClick={() => s.setIsResubmitting(false)}>Cancel</button>}
                            </div>
                            </div>
                        )}
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>approve</div><div style={{ color: "#6b7280", fontSize: 13 }}>requires status = Submitted</div><button style={{ ...btn, ...(s.busy || !canApprove ? btnDisabled : {}) }} disabled={s.busy || !canApprove} onClick={() => act("approve", { i: s.selectedMilestoneIdx })}>approve()</button></div>
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>reject</div><input style={input} value={s.reasonURI} onChange={(e) => s.setReasonURI(e.target.value)} placeholder="reason" /><button style={{ ...btnGhost, ...(s.busy || !canReject ? btnDisabled : {}) }} disabled={s.busy || !canReject} onClick={() => act("reject", { i: s.selectedMilestoneIdx, reasonURI: s.reasonURI })}>reject()</button></div>
                        <div style={actionRowGrid}><div style={{ color: "#6b7280" }}>claim</div><div style={{ color: "#6b7280", fontSize: 13 }}>{s.selectedMilestone?.status === 0 || s.selectedMilestone?.status === 3 ? "submit first" : s.selectedMilestone?.status === 1 ? (readyInSec === 0 ? "ready" : `ready in ${formatDuration(readyInSec)}`) : "not claimable"}</div><button style={{ ...btn, ...(s.busy || !canClaim ? btnDisabled : {}) }} disabled={s.busy || !canClaim} onClick={() => act("claim", { i: s.selectedMilestoneIdx })}>claim()</button></div>
                        </div>
                    )}
                    {s.selectedMilestone?.status === 4 && <div style={{ padding: 20, textAlign: 'center', color: '#166534', background:'#f0fdf4', borderRadius:8 }}>🎉 Payment Complete for Milestone #{s.selectedMilestoneIdx}</div>}
                </div>
            </>
            ) : (
            <div style={{ color: "#6b7280", textAlign:'center', marginTop: 40 }}>Select a project from the left list.</div>
            )}
        </section>
    );
}

