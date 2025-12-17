import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase'; // Supabase 클라이언트
// fs, path 제거됨

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

// 환경변수 체크
const RPC = process.env.ESCROW_RPC_URL!;
const FACTORY = process.env.FACTORY_ADDRESS as `0x${string}`;

// 서버 사이드 지갑 (데모용)
const CLIENT_PK = process.env.CLIENT_PK as `0x${string}`;
const PROVIDER_PK = process.env.PROVIDER_PK as `0x${string}`;

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });

// ---------------------------------------------------------
// Helper: 지갑 생성
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Core: 블록체인 상태 읽기
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// GET: DB 목록 + 체인 상태
// ---------------------------------------------------------
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const selectedParam = url.searchParams.get("escrow");

    // 1. Supabase 조회
    const { data: escrowsData, error } = await supabase
      .from('escrows')
      .select('*')
      .order('created_at', { ascending: false });

    // 에러나면 빈 배열 처리 (any 타입 캐스팅으로 에러 방지)
    const escrows = escrowsData 
      ? (escrowsData as any[]).map((e: any) => e.address) 
      : [];

    // 2. 선택된 에스크로 스냅샷
    let selected: `0x${string}` | null = null;
    if (selectedParam && isAddress(selectedParam)) {
      selected = getAddress(selectedParam) as `0x${string}`;
    } else if (escrows.length > 0) {
      selected = getAddress(escrows[0]) as `0x${string}`;
    }

    const snapshot = selected ? await readEscrowSnapshot(selected) : null;

    return NextResponse.json({
      ok: true,
      escrows, 
      dbData: escrowsData, // 제목 등을 위해 DB 데이터 원본도 전달
      selected,
      snapshot,
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}

// ---------------------------------------------------------
// POST: 액션 처리
// ---------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    // --- [ 1. Create Escrow ] ---
    if (action === "createEscrow") {
      const clientAddr = (body?.client as string) || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const providerAddr = (body?.provider as string) || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
      const amountsEth: string[] = body.amountsEth || ["0.001"];
      const deadlinesSec: number[] = body.deadlinesSec || [Math.floor(Date.now()/1000) + 86400];

      const amounts = amountsEth.map((x) => parseEther(String(x)));
      const deadlines = deadlinesSec.map((x) => BigInt(x));

      // A. Factory 호출
      const { wc, account } = wallet("client");
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

      // C. Supabase 저장
      if (escrow) {
        await supabase.from('escrows').insert([{
          address: escrow,
          client_address: getAddress(clientAddr),
          provider_address: getAddress(providerAddr),
          total_amount: amounts.reduce((a, b) => a + b, 0n).toString(),
          title: body.title || "Untitled Project",
          chain_id: sepolia.id
        }]);
      }

      return NextResponse.json({ ok: true, action, hash, escrow });
    }

    // --- [ 2. Common Escrow Actions ] ---
    const escrowParam = body?.escrow as string;
    if (!isAddress(escrowParam)) {
      return NextResponse.json({ ok: false, error: { message: "escrow address required" } }, { status: 400 });
    }
    const ESCROW = getAddress(escrowParam) as `0x${string}`;

    // FUND
    if (action === "fund") {
        const { wc, account } = wallet("client");
        const totalAmount = await publicClient.readContract({
            address: ESCROW, abi: escrowAbi, functionName: "totalAmount"
        });
        const hash = await wc.writeContract({
            address: ESCROW, abi: escrowAbi, functionName: "fund", args: [], value: totalAmount, account
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return NextResponse.json({ ok: true, action, hash });
    }

    // SUBMIT (누락되었던 부분 복구!)
    if (action === "submit") {
      const { i, proofURI } = body;
      const { wc, account } = wallet("provider");

      const hash = await wc.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "submit",
        args: [BigInt(i), String(proofURI)],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return NextResponse.json({ ok: true, action, hash });
    }

    // APPROVE (누락되었던 부분 복구!)
    if (action === "approve") {
      const { i } = body;
      const { wc, account } = wallet("client");

      const hash = await wc.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "approve",
        args: [BigInt(i)],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return NextResponse.json({ ok: true, action, hash });
    }

    // REJECT (누락되었던 부분 복구!)
    if (action === "reject") {
      const { i, reasonURI } = body;
      const { wc, account } = wallet("client");
      const hash = await wc.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "reject",
        args: [BigInt(i), String(reasonURI)],
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return NextResponse.json({ ok: true, action, hash });
    }

    // CLAIM (누락되었던 부분 복구!)
    if (action === "claim") {
      const { i, reasonURI } = body;
      const { wc, account } = wallet("provider");
      
      try {
        const hash = await wc.writeContract({
          address: ESCROW,
          abi: escrowAbi,
          functionName: "claim",
          args: [BigInt(i)], // claim은 인자가 index 하나입니다 (컨트랙트 확인 필요)
          account,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return NextResponse.json({ ok: true, action, hash });
      } catch (e: any) {
         // Revert 사유 파악용 에러 반환
         return NextResponse.json({ 
             ok: false, 
             error: errToJson(e) 
         }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: false, error: { message: "unknown action" } }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}