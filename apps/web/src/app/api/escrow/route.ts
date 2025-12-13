import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { escrowAbi } from "@/lib/escrowAbi";

const RPC = process.env.ESCROW_RPC_URL!;
const ADDRESS = process.env.ESCROW_ADDRESS as `0x${string}`;
const CLIENT_PK = process.env.CLIENT_PK as `0x${string}`;
const PROVIDER_PK = process.env.PROVIDER_PK as `0x${string}`;

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) });

function wallet(role: "client" | "provider") {
  const pk = role === "client" ? CLIENT_PK : PROVIDER_PK;
  const account = privateKeyToAccount(pk);
  const wc = createWalletClient({ chain: foundry, transport: http(RPC), account });
  return { wc, account };
}

export async function GET() {
  const [client, provider, funded, totalAmount, count] = await Promise.all([
    publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "client" }),
    publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "provider" }),
    publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "funded" }),
    publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "totalAmount" }),
    publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "milestonesCount" }),
  ]);

  const idxs = Array.from({ length: Number(count) }, (_, i) => i);
  const milestones = await Promise.all(
    idxs.map(async (i) => {
      const m: any = await publicClient.readContract({
        address: ADDRESS,
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
      };
    })
  );

  return NextResponse.json({
    address: ADDRESS,
    rpc: RPC,
    client,
    provider,
    funded,
    totalAmountEth: formatEther(totalAmount),
    count: Number(count),
    milestones,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = body?.action as string;

  if (action === "fund") {
    const { wc, account } = wallet("client");
    const totalAmount = await publicClient.readContract({ address: ADDRESS, abi: escrowAbi, functionName: "totalAmount" });
    const hash = await wc.writeContract({
      address: ADDRESS,
      abi: escrowAbi,
      functionName: "fund",
      args: [],
      value: totalAmount,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, hash });
  }

  if (action === "submit") {
    const { i, proofURI } = body;
    const { wc, account } = wallet("provider");
    const hash = await wc.writeContract({
      address: ADDRESS,
      abi: escrowAbi,
      functionName: "submit",
      args: [BigInt(i), String(proofURI)],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, hash });
  }

  if (action === "approve") {
    const { i } = body;
    const { wc, account } = wallet("client");
    const hash = await wc.writeContract({
      address: ADDRESS,
      abi: escrowAbi,
      functionName: "approve",
      args: [BigInt(i)],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, hash });
  }

  if (action === "reject") {
    const { i, reasonURI } = body;
    const { wc, account } = wallet("client");
    const hash = await wc.writeContract({
      address: ADDRESS,
      abi: escrowAbi,
      functionName: "reject",
      args: [BigInt(i), String(reasonURI)],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, hash });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
