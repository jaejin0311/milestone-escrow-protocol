import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getEscrowConfig, getSupabaseConfig } from "@/lib/config";

export const runtime = "nodejs";

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  getAddress,
  isAddress,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { escrowAbi } from "@/lib/escrowAbi";
import { factoryAbi } from "@/lib/factoryAbi";

type EscrowConfig = ReturnType<typeof getEscrowConfig>;

function createPublicClientFromConfig(config: EscrowConfig) {
  return createPublicClient({ chain: sepolia, transport: http(config.RPC) });
}

function createWalletFromConfig(config: EscrowConfig, role: "client" | "provider") {
  const pk = role === "client" ? config.CLIENT_PK : config.PROVIDER_PK;
  const account = privateKeyToAccount(pk);
  const wc = createWalletClient({ chain: sepolia, transport: http(config.RPC), account });
  return { wc, account };
}

// Fallback gas limit when RPC returns 0 from estimateGas (e.g. empty wallet or RPC quirk)
const DEFAULT_GAS_LIMIT = 300_000n;
// createEscrow deploys a new contract; needs more gas (was reverting at ~98.5% of 1.5M)
const CREATE_ESCROW_GAS_LIMIT = 2_500_000n;

function errToJson(e: any) {
  return {
    message: e?.shortMessage || e?.message || String(e),
    name: e?.name,
    cause: e?.cause ? String(e.cause) : undefined,
  };
}

// --- Read State ---
async function readEscrowSnapshot(
  escrow: `0x${string}`,
  publicClient: ReturnType<typeof createPublicClientFromConfig>
) {
  const [client, provider, funded, totalAmount, count] = await Promise.all([
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "client" }),
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "provider" }),
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "funded" }),
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "totalAmount" }),
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "milestonesCount" }),
  ]);

  const idxs = Array.from({ length: Number(count) }, (_, i) => i);

  const milestones = await Promise.all(
    idxs.map(async (i) => {
      const m: any = await publicClient.readContract({
        address: escrow,
        abi: escrowAbi,
        functionName: "getMilestone",
        args: [BigInt(i)],
      });

      return {
        i,
        amountEth: formatEther(m.amount),
        deadline: Number(m.deadline),
        status: Number(m.status),
        proofURI: m.proofURI,
        reasonURI: m.reasonURI,
        submittedAt: Number(m.submittedAt),
      };
    })
  );

  const block = await publicClient.getBlock();
  
  return {
    address: escrow,
    funded,
    totalAmountEth: formatEther(totalAmount),
    client,
    provider,
    count: Number(count),
    chainTime: Number(block.timestamp),
    milestones,
  };
}

// --- GET Handler ---
export async function GET(req: Request) {
  try {
    const config = getEscrowConfig();
    getSupabaseConfig();
    const publicClient = createPublicClientFromConfig(config);

    const url = new URL(req.url);
    const selectedParam = url.searchParams.get("escrow");

    const { data: escrowsData } = await supabase
      .from('escrows')
      .select('*')
      .order('created_at', { ascending: false });

    const escrows = escrowsData ? (escrowsData as any[]).map((e: any) => e.address) : [];

    let selected: `0x${string}` | null = null;
    if (selectedParam && isAddress(selectedParam)) {
      selected = getAddress(selectedParam) as `0x${string}`;
    } else if (escrows.length > 0) {
      selected = getAddress(escrows[0]) as `0x${string}`;
    }

    const snapshot = selected ? await readEscrowSnapshot(selected, publicClient) : null;

    const signerAddress = privateKeyToAccount(config.CLIENT_PK).address;

    return NextResponse.json({ ok: true, escrows, dbData: escrowsData, selected, snapshot, signerAddress, factoryAddress: config.FACTORY });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}

// --- POST Handler ---
export async function POST(req: Request) {
  try {
    const config = getEscrowConfig();
    const publicClient = createPublicClientFromConfig(config);

    const body = await req.json();
    const action = body?.action as string;

    // [1] Create Escrow
    if (action === "createEscrow") {
      const clientAddr = (body?.client as string)?.trim() || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const providerAddr = (body?.provider as string)?.trim() || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const amountsEth: string[] = Array.isArray(body?.amountsEth) ? body.amountsEth.map(String) : body?.amountsEth ? [String(body.amountsEth)] : ["0.001"];
      const deadlinesSecRaw: number[] = Array.isArray(body?.deadlinesSec) ? body.deadlinesSec : body?.deadlinesSec != null ? [Number(body.deadlinesSec)] : [Math.floor(Date.now() / 1000) + 86400];
      const deadlinesSec = deadlinesSecRaw.filter((x) => Number.isFinite(x));

      if (!isAddress(clientAddr) || !isAddress(providerAddr)) {
        return NextResponse.json({ ok: false, error: { message: "Invalid client or provider address (ZERO_ADDR)." } }, { status: 400 });
      }
      if (amountsEth.length === 0 || deadlinesSec.length === 0) {
        return NextResponse.json({ ok: false, error: { message: "Need at least one milestone (NO_MILESTONES)." } }, { status: 400 });
      }
      if (amountsEth.length !== deadlinesSec.length) {
        return NextResponse.json({ ok: false, error: { message: `Amounts (${amountsEth.length}) and deadlines (${deadlinesSec.length}) must have the same length (LEN_MISMATCH). Use e.g. "0.001,0.002" and "7,14" for 2 milestones.` } }, { status: 400 });
      }

      const amounts = amountsEth.map((x) => parseEther(String(x).trim()));
      for (let i = 0; i < amounts.length; i++) {
        if (amounts[i] === 0n) {
          return NextResponse.json({ ok: false, error: { message: `Milestone ${i + 1} amount must be > 0 (ZERO_AMOUNT). Check ETH amounts.` } }, { status: 400 });
        }
      }
      const deadlines = deadlinesSec.map((x) => BigInt(x));

      const { wc, account } = createWalletFromConfig(config, "client");

      const createArgs = [getAddress(clientAddr), getAddress(providerAddr), amounts, deadlines] as const;

      try {
        await publicClient.simulateContract({
          address: config.FACTORY,
          abi: factoryAbi,
          functionName: "createEscrow",
          args: createArgs,
          account,
        });
      } catch (simErr: any) {
        const msg = simErr?.shortMessage || simErr?.message || simErr?.details || String(simErr);
        return NextResponse.json({
          ok: false,
          error: { message: `Create escrow would revert. ${msg}` },
        }, { status: 400 });
      }

      const hash = await wc.writeContract({
        address: config.FACTORY,
        abi: factoryAbi,
        functionName: "createEscrow",
        args: createArgs,
        account,
        gas: CREATE_ESCROW_GAS_LIMIT,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        const txUrl = `https://sepolia.etherscan.io/tx/${hash}`;
        return NextResponse.json({
          ok: false,
          error: {
            message: `Create escrow reverted on-chain. If you recently redeployed the Factory, try again (gas limit was increased). Otherwise check: same number of ETH amounts and days, each amount > 0, valid addresses. Details: ${txUrl}`,
            transactionHash: hash,
          },
        }, { status: 500 });
      }

      // Parse EscrowCreated from Factory only (same address as log source)
      let escrow: `0x${string}` | null = null;
      const factoryLogs = receipt.logs.filter((l) => l.address?.toLowerCase() === config.FACTORY.toLowerCase());
      const parsed = parseEventLogs({ abi: factoryAbi, logs: factoryLogs });
      for (const p of parsed) {
        if (p.eventName === "EscrowCreated" && (p.args as any)?.escrow) {
          escrow = getAddress((p.args as any).escrow as string) as `0x${string}`;
          break;
        }
      }

      return NextResponse.json({ ok: true, action, hash, escrow: escrow ?? undefined });
    }

    // [2] Save DB
    if (action === "saveEscrow") {
      getSupabaseConfig();

      const { escrowAddress, client, provider, amountsEth, title } = body;
      const totalWei = amountsEth.reduce((acc: bigint, val: string) => acc + parseEther(val), 0n);

      const { error } = await supabase.from("escrows").insert([{
        address: getAddress(escrowAddress),
        client_address: getAddress(client),
        provider_address: getAddress(provider),
        total_amount: totalWei.toString(),
        title: title || "Untitled Project",
        chain_id: sepolia.id
      }]);
      if (error) throw error;
      return NextResponse.json({ ok: true, saved: true });
    }

    // [3] Other Actions
    const escrowParam = body?.escrow as string;
    if (!isAddress(escrowParam)) return NextResponse.json({ ok: false, error: "addr req" }, { status: 400 });
    const ESCROW = getAddress(escrowParam) as `0x${string}`;

    async function sendTx(role: "client" | "provider", fnName: string, args: any[], val: bigint = 0n) {
        const { wc, account } = createWalletFromConfig(config, role);
        const hash = await wc.writeContract({
            address: ESCROW,
            abi: escrowAbi,
            functionName: fnName as any,
            args: args as any,
            account,
            value: val,
            gas: DEFAULT_GAS_LIMIT,
        });
        return hash;
    }

    if (action === "fund") {
        const totalAmount = await publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "totalAmount" });
        const hash = await sendTx("client", "fund", [], totalAmount as bigint);
        return NextResponse.json({ ok: true, action, hash });
    }
    if (action === "submit") {
      const { i, proofURI } = body;
      const hash = await sendTx("provider", "submit", [BigInt(i), String(proofURI)]);
      return NextResponse.json({ ok: true, action, hash });
    }
    if (action === "approve") {
      const { i } = body;
      const hash = await sendTx("client", "approve", [BigInt(i)]);
      return NextResponse.json({ ok: true, action, hash });
    }
    if (action === "reject") {
      const { i, reasonURI } = body;
      const hash = await sendTx("client", "reject", [BigInt(i), String(reasonURI)]);
      return NextResponse.json({ ok: true, action, hash });
    }
    if (action === "claim") {
      const { i } = body;
      const hash = await sendTx("provider", "claim", [BigInt(i)]);
      return NextResponse.json({ ok: true, action, hash });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}