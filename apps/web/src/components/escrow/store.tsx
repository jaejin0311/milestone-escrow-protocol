"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

// --- Types ---
export type EscrowMetadata = {
  address: string;
  title: string;
  client_address: string;
  provider_address: string;
  total_amount: string;
  created_at: string;
};

export type Milestone = {
  i: number;
  amountEth: string;
  deadline: number;
  status: number;
  proofURI: string;
  reasonURI: string;
  submittedAt: number;
};

export type Snapshot = {
  address: string;
  funded: boolean;
  totalAmountEth: string;
  client: string;
  provider: string;
  count: number;
  milestones: Milestone[];
  chainTime: number;
};

export type ApiState = {
  ok: boolean;
  rpc: string;
  factory: string;
  escrows: string[];
  dbData?: EscrowMetadata[];
  selected: string | null;
  snapshot: Snapshot | null;
  signerAddress?: string;
  factoryAddress?: string;
};

export type EscrowStore = {
  clientAddr: string;
  setClientAddr: React.Dispatch<React.SetStateAction<string>>;
  providerAddr: string;
  setProviderAddr: React.Dispatch<React.SetStateAction<string>>;
  amountsEthCsv: string;
  setAmountsEthCsv: React.Dispatch<React.SetStateAction<string>>;
  deadlinesDaysCsv: string;
  setDeadlinesDaysCsv: React.Dispatch<React.SetStateAction<string>>;
  titleInput: string;
  setTitleInput: React.Dispatch<React.SetStateAction<string>>;

  state: ApiState | null;
  setState: React.Dispatch<React.SetStateAction<ApiState | null>>;
  escrowLimit: number;
  setEscrowLimit: React.Dispatch<React.SetStateAction<number>>;

  selectedMilestoneIdx: number;
  setSelectedMilestoneIdx: React.Dispatch<React.SetStateAction<number>>;

  descInput: string;
  setDescInput: React.Dispatch<React.SetStateAction<string>>;
  fileUrl: string;
  setFileUrl: React.Dispatch<React.SetStateAction<string>>;
  isResubmitting: boolean;
  setIsResubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  reasonURI: string;
  setReasonURI: React.Dispatch<React.SetStateAction<string>>;

  busy: boolean;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  log: string;
  setLog: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  notice: string | null;
  setNotice: React.Dispatch<React.SetStateAction<string | null>>;

  fetchedAtMs: number;
  setFetchedAtMs: React.Dispatch<React.SetStateAction<number>>;
  tick: number;
  setTick: React.Dispatch<React.SetStateAction<number>>;

  selectedEscrow: string | null;
  snap: Snapshot | null;
  selectedMilestone: Milestone | null;
  isAllPaid: boolean;
};

const Ctx = createContext<EscrowStore | null>(null);

export function EscrowProvider({ children }: { children: React.ReactNode }) {
  // Same address for both by default so one wallet can be used for testing (fund + submit + approve)
  const [clientAddr, setClientAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
  const [providerAddr, setProviderAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
  const [amountsEthCsv, setAmountsEthCsv] = useState("0.0001,0.0002");
  const [deadlinesDaysCsv, setDeadlinesDaysCsv] = useState("7,14");
  const [titleInput, setTitleInput] = useState("");

  const [state, setState] = useState<ApiState | null>(null);
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(0);
  const [escrowLimit, setEscrowLimit] = useState(20);

  const [descInput, setDescInput] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [reasonURI, setReasonURI] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fetchedAtMs, setFetchedAtMs] = useState(0);
  const [tick, setTick] = useState(0);

  const selectedEscrow = state?.selected ?? null;
  const snap = state?.snapshot ?? null;

  const selectedMilestone = useMemo(() => {
    if (!snap) return null;
    return snap.milestones.find((m) => m.i === selectedMilestoneIdx) ?? null;
  }, [snap, selectedMilestoneIdx]);

  const isAllPaid = useMemo(() => {
    if (!snap || snap.milestones.length === 0) return false;
    return snap.milestones.every((m) => m.status === 4);
  }, [snap]);

  const value = useMemo<EscrowStore>(
    () => ({
      clientAddr,
      setClientAddr,
      providerAddr,
      setProviderAddr,
      amountsEthCsv,
      setAmountsEthCsv,
      deadlinesDaysCsv,
      setDeadlinesDaysCsv,
      titleInput,
      setTitleInput,

      state,
      setState,
      escrowLimit,
      setEscrowLimit,

      selectedMilestoneIdx,
      setSelectedMilestoneIdx,

      descInput,
      setDescInput,
      fileUrl,
      setFileUrl,
      isResubmitting,
      setIsResubmitting,
      uploading,
      setUploading,
      reasonURI,
      setReasonURI,

      busy,
      setBusy,
      log,
      setLog,
      error,
      setError,
      notice,
      setNotice,

      fetchedAtMs,
      setFetchedAtMs,
      tick,
      setTick,

      selectedEscrow,
      snap,
      selectedMilestone,
      isAllPaid,
    }),
    [
      clientAddr,
      providerAddr,
      amountsEthCsv,
      deadlinesDaysCsv,
      titleInput,
      state,
      escrowLimit,
      selectedMilestoneIdx,
      descInput,
      fileUrl,
      isResubmitting,
      uploading,
      reasonURI,
      busy,
      log,
      error,
      notice,
      fetchedAtMs,
      tick,
      selectedEscrow,
      snap,
      selectedMilestone,
      isAllPaid,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEscrowStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEscrowStore must be used inside <EscrowProvider />");
  return ctx;
}
