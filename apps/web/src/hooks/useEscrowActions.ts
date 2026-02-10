"use client";

import { useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getClientRpcUrl } from "@/lib/rpc";
import { createPublicClient, http, parseEventLogs, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { factoryAbi } from "@/lib/factoryAbi";
import { useEscrowStore } from "@/components/escrow/store";

export function useEscrowActions() {
  const s = useEscrowStore();
  const actingRef = useRef(false);

  function getEscrowTitle(addr: string) {
    if (!s.state?.dbData) return null;
    const found = s.state.dbData.find((d) => d.address.toLowerCase() === addr.toLowerCase());
    return found?.title || null;
  }

  async function post(action: string, payload: any = {}, opts?: { keepBusy?: boolean }) {
    s.setBusy(true);
    try {
      s.setLog("...");
      s.setError(null);
      s.setNotice(null);

      const res = await fetch("/api/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
        s.setLog(JSON.stringify(json, null, 2));
      } catch {
        s.setLog(text || "(empty response)");
      }

      if (!res.ok) throw new Error(json?.error?.message || text || `HTTP ${res.status}`);
      return json;
    } finally {
      if (!opts?.keepBusy) s.setBusy(false);
    }
  }

  const REFRESH_RETRIES = 2;
  const REFRESH_RETRY_DELAY_MS = 1500;

  async function refresh(escrow?: string | null, opts?: { autoPick?: boolean }) {
    // ✅ 클릭 즉시 선택 선반영
    if (escrow) {
      s.setState((prev) => (prev ? { ...prev, selected: escrow } : prev));
    }

    const params = new URLSearchParams();
    params.set("limit", String(s.escrowLimit));
    if (escrow) params.set("escrow", escrow);

    const url = `/api/escrow?${params.toString()}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= REFRESH_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();

        if (!res.ok) {
          const errMsg = (() => {
            try {
              const j = JSON.parse(text);
              return j?.error?.message || text || `HTTP ${res.status}`;
            } catch {
              return text || `HTTP ${res.status}`;
            }
          })();
          throw new Error(errMsg);
        }

        const data = JSON.parse(text);
        if (data?.ok === false) {
          throw new Error(data?.error?.message || "API returned ok: false");
        }

        // ✅ API가 selected를 안 주거나 null이면 클라이언트가 보정
        if (escrow && (!data?.selected || data.selected === null)) data.selected = escrow;

        s.setFetchedAtMs(Date.now());
        s.setState(data);
        s.setError(null); // clear load error on success

        const ms = data?.snapshot?.milestones ?? [];
        if ((opts?.autoPick ?? false) && ms.length > 0) {
          const nextIdx = ms.find((x: any) => x.status === 0 || x.status === 3)?.i ?? 0;
          s.setSelectedMilestoneIdx(nextIdx);
        }

        const count = data?.snapshot?.milestones?.length ?? 0;
        if (count > 0 && s.selectedMilestoneIdx >= count) s.setSelectedMilestoneIdx(0);
        return;
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e));
        s.setLog(lastError.message + (attempt < REFRESH_RETRIES ? ` (retry ${attempt + 1}/${REFRESH_RETRIES} in ${REFRESH_RETRY_DELAY_MS / 1000}s…)` : ""));
        if (attempt < REFRESH_RETRIES) {
          await new Promise((r) => setTimeout(r, REFRESH_RETRY_DELAY_MS));
        }
      }
    }

    s.setError("Couldn't load escrows. Check Supabase (resume project if paused) or try again.");
    if (lastError) s.setLog(lastError.message);
  }



  async function createNewEscrow() {
    const amountsEth = s.amountsEthCsv.split(",").map((x) => x.trim()).filter(Boolean);
    const days = s.deadlinesDaysCsv
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (amountsEth.length === 0 || days.length === 0) {
      s.setError("Enter at least one ETH amount and one day (e.g. 0.001 and 7).");
      return;
    }
    if (amountsEth.length !== days.length) {
      s.setError(`You have ${amountsEth.length} amount(s) and ${days.length} day(s). They must match (e.g. 0.001,0.002 and 7,14).`);
      return;
    }
    let zeroIdx = -1;
    try {
      zeroIdx = amountsEth.findIndex((a) => !a.trim() || parseEther(a.trim()) === 0n);
    } catch {
      s.setError("Invalid ETH amount format (e.g. use 0.001 not text).");
      return;
    }
    if (zeroIdx !== -1) {
      s.setError(`Milestone ${zeroIdx + 1} amount must be > 0. Check the ETH field.`);
      return;
    }

    const nowSec =
      s.snap?.chainTime && s.fetchedAtMs
        ? s.snap.chainTime + Math.floor((Date.now() - s.fetchedAtMs) / 1000)
        : Math.floor(Date.now() / 1000);

    const deadlinesSec = days.map((d) => nowSec + d * 24 * 60 * 60);

    if (actingRef.current) return;
    actingRef.current = true;
    s.setBusy(true);
    s.setLog("Initiating transaction...");
    s.setError(null);

    try {
      const out = await post("createEscrow", {
        client: s.clientAddr,
        provider: s.providerAddr,
        amountsEth,
        deadlinesSec,
      }, { keepBusy: true });

      if (!out?.hash) throw new Error("No tx hash returned");

      let newEscrowAddr: string | undefined = out.escrow;
      if (!newEscrowAddr) {
        s.setLog(`Transaction sent: ${out.hash}\nWaiting for mining on Sepolia...`);
        const publicClient = createPublicClient({ chain: sepolia, transport: http(getClientRpcUrl()) });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: out.hash });
        s.setLog(`Mined in block ${receipt.blockNumber}! Finding escrow address...`);
        const factoryAddr = s.state?.factoryAddress;
        const logs = factoryAddr ? receipt.logs.filter((l: any) => l.address?.toLowerCase() === factoryAddr?.toLowerCase()) : receipt.logs;
        const parsed = parseEventLogs({ abi: factoryAbi, logs, eventName: "EscrowCreated" });
        newEscrowAddr = (parsed[0] as any)?.args?.escrow;
        if (!newEscrowAddr) throw new Error("Could not parse EscrowCreated event. Try refreshing and creating again.");
      }

      await post("saveEscrow", {
        escrowAddress: newEscrowAddr,
        client: s.clientAddr,
        provider: s.providerAddr,
        amountsEth,
        title: s.titleInput || "Untitled Project",
      });

      s.setTitleInput("");
      await refresh(newEscrowAddr);
      s.setNotice("Success! Escrow created and saved.");
    } catch (e: any) {
      s.setError(e?.message || String(e));
    } finally {
      actingRef.current = false;
      s.setBusy(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    s.setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("proofs").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("proofs").getPublicUrl(filePath);
      s.setFileUrl(data.publicUrl);
      s.setLog(`File uploaded: ${data.publicUrl}`);
    } catch (err: any) {
      s.setError(err.message);
      s.setLog(`Upload failed: ${err.message}`);
    } finally {
      s.setUploading(false);
    }
  }

  async function act(action: string, payload: any = {}) {
    if (!s.selectedEscrow) return;
    if (actingRef.current) return;
    actingRef.current = true;
    s.setBusy(true);
    s.setLog(`Initiating ${action}...`);
    s.setError(null);

    try {
      const res = await post(action, { escrow: s.selectedEscrow, ...payload }, { keepBusy: true });

      if (res.hash) {
        s.setLog(`Tx sent: ${res.hash}\nWaiting for mining...`);
        const publicClient = createPublicClient({ chain: sepolia, transport: http(getClientRpcUrl()) });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: res.hash });
        if (receipt.status === "reverted") {
          const hints: Record<string, string> = {
            submit: "Possible: NOT_FUNDED (fund first), PREV_NOT_PAID (complete prior milestone), BAD_STATUS (already submitted?), EMPTY_PROOF (add description or file), NOT_PROVIDER (escrow was created with a different provider address — create a new escrow with the same Client and Provider address if using one wallet).",
            fund: "Possible: ALREADY_FUNDED or BAD_VALUE.",
            approve: "Possible: NOT_SUBMITTED (provider must submit first).",
            reject: "Possible: NOT_SUBMITTED.",
            claim: "Possible: BAD_STATUS, NO_SUBMIT_TS, or DISPUTE_WINDOW not passed.",
          };
          const hint = hints[action] || "Check the transaction on Etherscan for the revert reason.";
          throw new Error(`Transaction reverted on-chain. ${hint}`);
        }
        s.setLog(`Transaction mined! Updating UI...`);
      }

      if (action === "fund") {
        s.setState((prev) => {
          if (!prev?.snapshot) return prev;
          return { ...prev, snapshot: { ...prev.snapshot, funded: true } };
        });
      }

      if (action === "submit") {
        const { i, proofURI } = payload;
        const idx = typeof i === "number" ? i : Number(i);
        s.setState((prev) => {
          if (!prev?.snapshot?.milestones || idx < 0 || idx >= prev.snapshot.milestones.length) return prev;
          const milestones = prev.snapshot.milestones.map((m, j) =>
            j === idx ? { ...m, status: 1, proofURI: proofURI ?? m.proofURI, submittedAt: Math.floor(Date.now() / 1000) } : m
          );
          return { ...prev, snapshot: { ...prev.snapshot, milestones } };
        });
        s.setIsResubmitting(false);
        s.setDescInput("");
        s.setFileUrl("");
      }

      if (action === "approve" || action === "claim") {
        const { i } = payload;
        const idx = typeof i === "number" ? i : Number(i);
        s.setState((prev) => {
          if (!prev?.snapshot?.milestones || idx < 0 || idx >= prev.snapshot.milestones.length) return prev;
          const milestones = prev.snapshot.milestones.map((m, j) => (j === idx ? { ...m, status: 4 } : m));
          return { ...prev, snapshot: { ...prev.snapshot, milestones } };
        });
      }

      if (action === "reject") {
        const { i } = payload;
        const idx = typeof i === "number" ? i : Number(i);
        s.setState((prev) => {
          if (!prev?.snapshot?.milestones || idx < 0 || idx >= prev.snapshot.milestones.length) return prev;
          const milestones = prev.snapshot.milestones.map((m, j) => (j === idx ? { ...m, status: 3 } : m));
          return { ...prev, snapshot: { ...prev.snapshot, milestones } };
        });
        s.setReasonURI("");
      }

      s.setNotice(`Success: ${action}`);
      // Brief delay so RPC has the new block, then refresh to sync with chain
      await new Promise((r) => setTimeout(r, 500));
      await refresh(s.selectedEscrow);
    } catch (e: any) {
      s.setError(e?.message || String(e));
    } finally {
      actingRef.current = false;
      s.setBusy(false);
    }
  }

  // 권한/상태 계산. 기존 로직 있으면 여기로 이관.
  const readyInSec = 0;
  const canFund = Boolean(s.selectedEscrow && s.snap && !s.snap.funded);
  const canSubmit = Boolean(s.selectedMilestone && (s.selectedMilestone.status === 0 || s.selectedMilestone.status === 3));
  const canApprove = Boolean(s.selectedMilestone && s.selectedMilestone.status === 1);
  const canReject = Boolean(s.selectedMilestone && s.selectedMilestone.status === 1);
  const canClaim = Boolean(s.selectedMilestone && s.selectedMilestone.status === 1);

  return {
    getEscrowTitle,
    refresh,
    createNewEscrow,
    act,
    handleFileUpload,
    readyInSec,
    canFund,
    canSubmit,
    canApprove,
    canReject,
    canClaim,
  };
}
