# Milestone Escrow Web

Next.js app for the [Milestone Escrow Protocol](../../README.md): create escrows, fund, submit proofs, approve/reject, and claim. Uses Supabase for escrow list + proof storage; transactions run via API routes (demo: no wallet required).

## Getting Started

1. **Copy env and fill values** (see [root README](../../README.md) for full setup):

   ```bash
   cp .env.example .env.local
   ```

   Required in `.env.local`:

   | Variable | Description |
   |----------|-------------|
   | `ESCROW_RPC_URL` | RPC URL (e.g. Anvil `http://127.0.0.1:8545` or Sepolia) |
   | `FACTORY_ADDRESS` | Deployed factory contract address |
   | `CLIENT_PK` | Client wallet private key (0x prefix) |
   | `PROVIDER_PK` | Provider wallet private key (0x prefix) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

   ⚠️ Never commit `.env.local`; it contains private keys (demo only).

2. **Install and run** (from repo root with pnpm, or here with npm/pnpm):

   ```bash
   pnpm install
   pnpm dev
   ```

   Or from repo root: `pnpm --filter web dev`.

3. Open [http://localhost:3000](http://localhost:3000).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Project README](../../README.md) — contracts, deploy, Supabase, demo flow
