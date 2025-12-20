"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createPublicClient, http, parseEventLogs } from "viem";
import { sepolia } from "viem/chains";
import { factoryAbi } from "@/lib/factoryAbi";
import { useEscrowStore } from "@/components/escrow/store";

export function useEscrow() {
  const s = useEscrowStore();

  // tick
  useEffect(() => {
    const id = setInterval(() => s.setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [s]);

  function getEscrowTitle(addr: string) {
    if (!s.state?.dbData) return null;
    const found = s.state.dbData.find((d) => d.address.toLowerCase() === addr.toLowerCase());
    return found?.title || null;
  }

  async function post(action: string, payload: any = {}) {
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
      s.setBusy(false);
    }
  }

  async function refresh(escrow?: string | null, opts?: { autoPick?: boolean }) {
    const params = new URLSearchParams();
    params.set("limit", String(s.escrowLimit));
    if (escrow) params.set("escrow", escrow);

    const res = await fetch(`/api/escrow?${params.toString()}`, { cache: "no-store" });
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      s.setFetchedAtMs(Date.now());
      s.setState(data);

      const ms = data?.snapshot?.milestones ?? [];
      if ((opts?.autoPick ?? false) && ms.length > 0) {
        const nextIdx = ms.find((x: any) => x.status === 0 || x.status === 3)?.i ?? 0;
        s.setSelectedMilestoneIdx(nextIdx);
      }
      const count = data?.snapshot?.milestones?.length ?? 0;
      if (count > 0 && s.selectedMilestoneIdx >= count) s.setSelectedMilestoneIdx(0);
    } catch {
      s.setLog(text || "(empty response)");
    }
  }

  async function createNewEscrow() {
    if (s.clientAddr.toLowerCase() === s.providerAddr.toLowerCase()) {
      s.setError("Client and Provider address must be different!");
      return;
    }

    const amountsEth = s.amountsEthCsv.split(",").map((x) => x.trim()).filter(Boolean);
    const days = s.deadlinesDaysCsv
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const nowSec =
      s.snap?.chainTime && s.fetchedAtMs
        ? s.snap.chainTime + Math.floor((Date.now() - s.fetchedAtMs) / 1000)
        : Math.floor(Date.now() / 1000);

    const deadlinesSec = days.map((d) => nowSec + d * 24 * 60 * 60);

    s.setBusy(true);
    s.setLog("Initiating transaction...");
    s.setError(null);

    try {
      const out = await post("createEscrow", {
        client: s.clientAddr,
        provider: s.providerAddr,
        amountsEth,
        deadlinesSec,
      });

      if (!out?.hash) throw new Error("No tx hash returned");

      s.setLog(`Transaction sent: ${out.hash}\nWaiting for mining on Sepolia...`);

      const rpcUrl = "https://ethereum-sepolia.publicnode.com";
      const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: out.hash });
      s.setLog(`Mined in block ${receipt.blockNumber}! Finding escrow address...`);

      const parsed = parseEventLogs({
        abi: factoryAbi,
        logs: receipt.logs,
        eventName: "EscrowCreated",
      });

      const newEscrowAddr = (parsed[0] as any)?.args?.escrow;
      if (!newEscrowAddr) throw new Error("Could not parse EscrowCreated event.");

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

    s.setBusy(true);
    s.setLog(`Initiating ${action}...`);
    s.setError(null);

    try {
      const res = await post(action, { escrow: s.selectedEscrow, ...payload });

      if (res.hash) {
        s.setLog(`Tx sent: ${res.hash}\nWaiting for mining...`);

        const rpcUrl = "https://ethereum-sepolia.publicnode.com";
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        await publicClient.waitForTransactionReceipt({ hash: res.hash });

        s.setLog(`Transaction mined! Updating UI...`);
      }

      // optimistic funded
      if (action === "fund") {
        s.setState((prev) => {
          if (!prev?.snapshot) return prev;
          return { ...prev, snapshot: { ...prev.snapshot, funded: true } };
        });
      }

      if (action === "submit") {
        s.setIsResubmitting(false);
        s.setDescInput("");
        s.setFileUrl("");
      }
      if (action === "reject") s.setReasonURI("");

      s.setNotice(`Success: ${action}`);
      await refresh(s.selectedEscrow);
      if (action === "reject") s.setReasonURI("");
    } catch (e: any) {
      s.setError(e?.message || String(e));
    } finally {
      s.setBusy(false);
    }
  }

  // page에서 쓰던 자동 refresh
  useEffect(() => {
    refresh(null).catch((e) => s.setLog(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.escrowLimit]);

  // (임시) 권한/조건 계산은 기존 로직이 있으면 그대로 옮기면 됨
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

    // derived flags
    readyInSec,
    canFund,
    canSubmit,
    canApprove,
    canReject,
    canClaim,
  };
}
