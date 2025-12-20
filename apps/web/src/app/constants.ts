import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createPublicClient, http, parseEventLogs } from "viem";
import { sepolia } from "viem/chains";
import { factoryAbi } from "@/lib/factoryAbi";
import EscrowList from "../components/escrow/MyEscrowList";

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

export const [clientAddr, setClientAddr] = useState("0xAFCe530A7D5D6CAB18129dfCdDd2A25F7B825a0D");
export const [providerAddr, setProviderAddr] = useState("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
export const [amountsEthCsv, setAmountsEthCsv] = useState("0.0001,0.0002");
export const [deadlinesDaysCsv, setDeadlinesDaysCsv] = useState("7,14");
export const [titleInput, setTitleInput] = useState("");
export const [state, setState] = useState<ApiState | null>(null);
export const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(0);
export const [escrowLimit, setEscrowLimit] = useState(20);
// Submit Form States
export const [descInput, setDescInput] = useState(""); 
export const [fileUrl, setFileUrl] = useState("");     
export const [isResubmitting, setIsResubmitting] = useState(false);
export const [uploading, setUploading] = useState(false);
// Common Action States
export const [reasonURI, setReasonURI] = useState("");
export const [busy, setBusy] = useState(false);
export const [log, setLog] = useState<string>("");
export const [error, setError] = useState<string | null>(null);
export const [notice, setNotice] = useState<string | null>(null);
export const selectedEscrow = state?.selected ?? null;
export const snap = state?.snapshot ?? null;
export const [fetchedAtMs, setFetchedAtMs] = useState(0);
export const [tick, setTick] = useState(0);
export const selectedMilestone = useMemo(() => {
    if (!snap) return null;
    return snap.milestones.find((m) => m.i === selectedMilestoneIdx) ?? null;
}, [snap, selectedMilestoneIdx]);
export const isAllPaid = useMemo(() => {
    if (!snap || snap.milestones.length === 0) return false;
    return snap.milestones.every((m) => m.status === 4);
}, [snap]);