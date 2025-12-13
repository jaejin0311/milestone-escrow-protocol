import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
export const runtime = "nodejs";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  getAddress,
  isAddress,
  parseAbiItem,
  parseEventLogs
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { escrowAbi } from "@/lib/escrowAbi";
import { factoryAbi } from "@/lib/factoryAbi";

const RPC = process.env.ESCROW_RPC_URL!;
const FACTORY = process.env.FACTORY_ADDRESS as `0x${string}`;
const CLIENT_PK = process.env.CLIENT_PK as `0x${string}`;
const PROVIDER_PK = process.env.PROVIDER_PK as `0x${string}`;

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const DATA_DIR = path.join(process.cwd(), ".data");
const ESCROWS_FILE = path.join(DATA_DIR, "escrows.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSavedEscrows(): `0x${string}`[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(ESCROWS_FILE)) return [];
    const raw = fs.readFileSync(ESCROWS_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => typeof x === "string" && isAddress(x))
      .map((x) => getAddress(x) as `0x${string}`);
  } catch {
    return [];
  }
}

function saveEscrow(addr: `0x${string}`) {
  ensureDataDir();
  const cur = new Set(loadSavedEscrows());
  cur.add(getAddress(addr) as `0x${string}`);
  fs.writeFileSync(ESCROWS_FILE, JSON.stringify(Array.from(cur), null, 2));
}

function pkAddrFromProcessEnv(name: "CLIENT_PK" | "PROVIDER_PK") {
  try {
    const pk = process.env[name] as `0x${string}` | undefined;
    if (!pk) return "(missing)";
    return privateKeyToAccount(pk).address;
  } catch {
    return "(invalid)";
  }
}

function pkAddrFromEnvLocalFile(name: "CLIENT_PK" | "PROVIDER_PK") {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return "(no .env.local)";
    const raw = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    const line = raw.find((l) => l.startsWith(name + "="));
    if (!line) return "(not in .env.local)";
    const val = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    return privateKeyToAccount(val as `0x${string}`).address;
  } catch {
    return "(invalid)";
  }
}

function readEnvLocal(key: string): string | undefined {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return undefined;

  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  const line = lines.find((l) => l.startsWith(key + "="));
  if (!line) return undefined;

  return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
}


function wallet(role: "client" | "provider") {
  const keyName = role === "client" ? "CLIENT_PK" : "PROVIDER_PK";

  // .env.local 값을 최우선으로 사용 (process.env는 덮어쓰기 이슈가 있어 보조로만)
  const pk =
    (readEnvLocal(keyName) || process.env[keyName]) as `0x${string}` | undefined;

  if (!pk) throw new Error(`Missing ${keyName}`);

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
      };
    })
  );

  return {
    address: escrow,
    funded,
    totalAmountEth: formatEther(totalAmount),
    client,
    provider,
    count: Number(count),
    milestones,
  };
}

export async function GET(req: Request) {
  try {
    if (!RPC || !FACTORY) {
      return NextResponse.json(
        { ok: false, error: { message: "Missing ESCROW_RPC_URL or FACTORY_ADDRESS" } },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") || "20");
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 20;

    const selectedParam = url.searchParams.get("escrow");

    const event = parseAbiItem(
      "event EscrowCreated(address indexed escrow, address indexed client, address indexed provider)"
    );

    // 1) 파일에 저장된 목록을 먼저 읽음
    const saved = loadSavedEscrows();

    // 2) 알케미 free tier 때문에 logs는 10블록만 스캔
    const latest = await publicClient.getBlockNumber();
    const fromBlock = latest > 9n ? latest - 9n : 0n;

    // 3) logs 조회는 실패할 수 있으니 try/catch
    let createdFromLogs: `0x${string}`[] = [];
    try {
      const logs = await publicClient.getLogs({
        address: FACTORY,
        event,
        fromBlock,
        toBlock: latest,
      });

      createdFromLogs = logs
        .map((l: any) => l.args?.escrow as string)
        .filter((x: string) => isAddress(x))
        .map((x: string) => getAddress(x) as `0x${string}`)
        .reverse(); // newest first
    } catch {
      // ignore: RPC log range limits etc.
    }

    // 4) logs + saved 합치기 (중복 제거) 후 limit 적용
    const escrows = Array.from(new Set([...createdFromLogs, ...saved]));
    const escrowsLimited = escrows.slice(0, limit);


    const selected =
      selectedParam && isAddress(selectedParam)
        ? (getAddress(selectedParam) as `0x${string}`)
        : escrowsLimited[0] ?? null;

    const snapshot = selected ? await readEscrowSnapshot(selected) : null;

    return NextResponse.json({
      ok: true,
      rpc: RPC,
      factory: FACTORY,
      escrows: escrowsLimited,
      selected,
      snapshot,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string;

    if (!RPC || !FACTORY) {
      return NextResponse.json(
        { ok: false, error: { message: "Missing ESCROW_RPC_URL or FACTORY_ADDRESS" } },
        { status: 500 }
      );
    }

    if (action === "createEscrow") {
      // Optional params from UI (fallback to sensible defaults)
      const clientAddr = (body?.client as string) || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const providerAddr = (body?.provider as string) || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

      if (!isAddress(clientAddr) || !isAddress(providerAddr)) {
        return NextResponse.json(
          { ok: false, error: { message: "invalid client/provider address" } },
          { status: 400 }
        );
      }

      const amountsEth: string[] = Array.isArray(body?.amountsEth) ? body.amountsEth : ["0.3", "0.7"];
      const nowSec = Math.floor(Date.now() / 1000);
      const deadlinesSec: number[] = Array.isArray(body?.deadlinesSec)
        ? body.deadlinesSec
        : [nowSec + 7 * 24 * 60 * 60, nowSec + 14 * 24 * 60 * 60];

      if (amountsEth.length === 0 || amountsEth.length !== deadlinesSec.length) {
        return NextResponse.json(
          { ok: false, error: { message: "amountsEth and deadlinesSec must have same non-zero length" } },
          { status: 400 }
        );
      }

      const amounts = amountsEth.map((x) => parseEther(String(x)));
      const deadlines = deadlinesSec.map((x) => BigInt(x));

      const { wc, account } = wallet("client");
      console.log("PK_ADDR process.env CLIENT =", pkAddrFromProcessEnv("CLIENT_PK"));
      console.log("PK_ADDR .env.local  CLIENT =", pkAddrFromEnvLocalFile("CLIENT_PK"));
      console.log("CREATE_ESCROW sender =", account.address);
      console.log("RPC =", RPC);
      console.log("FACTORY =", FACTORY);

      const hash = await wc.writeContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createEscrow",
        args: [
          getAddress(clientAddr) as `0x${string}`,
          getAddress(providerAddr) as `0x${string}`,
          amounts,
          deadlines,
        ],
        account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // parse event from receipt logs
      let escrow: `0x${string}` | null = null;
      const parsed = parseEventLogs({ abi: factoryAbi, logs: receipt.logs });

      for (const p of parsed) {
        if (p.eventName === "EscrowCreated") {
          const addr = p.args.escrow as string;
          if (isAddress(addr)) escrow = getAddress(addr) as `0x${string}`;
          break;
        }
      }
      if (escrow) saveEscrow(escrow);
      return NextResponse.json({ ok: true, action, hash, escrow, sender: account.address, clientAddr, providerAddr });
      }


    const escrowParam = body?.escrow as string;
    if (!isAddress(escrowParam)) {
      return NextResponse.json({ ok: false, error: { message: "escrow address required" } }, { status: 400 });
    }
    const ESCROW = getAddress(escrowParam) as `0x${string}`;

    if (action === "fund") {
      const { wc, account } = wallet("client");
      const totalAmount = await publicClient.readContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "totalAmount",
      });

      const hash = await wc.writeContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "fund",
        args: [],
        value: totalAmount,
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return NextResponse.json({ ok: true, action, hash });
    }

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

    return NextResponse.json({ ok: false, error: { message: "unknown action" } }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}
