import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export const runtime = "nodejs";

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  getAddress,
  isAddress,
  parseEventLogs
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { escrowAbi } from "@/lib/escrowAbi";
import { factoryAbi } from "@/lib/factoryAbi";

// .env.local 설정된 RPC 사용
const RPC = process.env.ESCROW_RPC_URL!;
const FACTORY = process.env.FACTORY_ADDRESS as `0x${string}`;
const CLIENT_PK = process.env.CLIENT_PK as `0x${string}`;
const PROVIDER_PK = process.env.PROVIDER_PK as `0x${string}`;

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

function wallet(role: "client" | "provider") {
  const pk = role === "client" ? CLIENT_PK : PROVIDER_PK;
  if (!pk) throw new Error(`Missing PK for ${role}`);
  const account = privateKeyToAccount(pk);
  const wc = createWalletClient({ chain: sepolia, transport: http(RPC), account });
  return { wc, account };
}

function errToJson(e: any) {
  return {
    message: e?.shortMessage || e?.message || String(e),
    name: e?.name,
    cause: e?.cause ? String(e.cause) : undefined,
  };
}

// --- Read State ---
async function readEscrowSnapshot(escrow: `0x${string}`) {
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

    const snapshot = selected ? await readEscrowSnapshot(selected) : null;

    return NextResponse.json({ ok: true, escrows, dbData: escrowsData, selected, snapshot });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}

// --- POST Handler ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    // [1] Create Escrow
    if (action === "createEscrow") {
      console.log("Creating Escrow with body:", body);
      const clientAddr = (body?.client as string) || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const providerAddr = (body?.provider as string) || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const amountsEth: string[] = body.amountsEth || ["0.001"];
      const deadlinesSec: number[] = body.deadlinesSec || [Math.floor(Date.now()/1000) + 86400];

      const amounts = amountsEth.map((x) => parseEther(String(x)));
      const deadlines = deadlinesSec.map((x) => BigInt(x));

      // ✅ 총 예치금 계산 (필수)
      // const totalValue = amounts.reduce((acc, val) => acc + val, 0n);

      const { wc, account } = wallet("client");

      // ✅ 정석 코드: Nonce, Gas 설정 없이 viem에게 맡김 (가장 안전함)
      const hash = await wc.writeContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createEscrow",
        args: [getAddress(clientAddr), getAddress(providerAddr), amounts, deadlines],
        account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // B. 주소 파싱
      let escrow: `0x${string}` | null = null;
      const parsed = parseEventLogs({ abi: factoryAbi, logs: receipt.logs });
      for (const p of parsed) {
        if (p.eventName === "EscrowCreated") {
          escrow = getAddress(p.args.escrow as string) as `0x${string}`;
          break;
        }
      }
      // // C. Supabase 저장
      // if (escrow) {
      //   await supabase.from('escrows').insert([{
      //     address: escrow,
      //     client_address: getAddress(clientAddr),
      //     provider_address: getAddress(providerAddr),
      //     total_amount: amounts.reduce((a, b) => a + b, 0n).toString(),
      //     title: body.title || "Untitled Project",
      //     chain_id: sepolia.id
      //   }]);
      // }
      return NextResponse.json({ ok: true, action, hash});
    }

    // [2] Save DB
    if (action === "saveEscrow") {
      const { escrowAddress, client, provider, amountsEth, title } = body;
      const totalWei = amountsEth.reduce((acc: bigint, val: string) => acc + parseEther(val), 0n);

      const { error } = await supabase.from('escrows').insert([{
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
        const { wc, account } = wallet(role);
        // ✅ 여기도 수동 설정 제거 (자동 모드)
        const hash = await wc.writeContract({
            address: ESCROW, 
            abi: escrowAbi, 
            functionName: fnName as any, 
            args: args as any, 
            account, 
            value: val
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