/**
 * Server-side env validation. Fails fast with a clear message if required vars are missing.
 * Copy .env.example to .env.local and set values.
 */

export function getEscrowConfig() {
  const RPC = process.env.ESCROW_RPC_URL?.trim();
  const FACTORY = process.env.FACTORY_ADDRESS?.trim();
  const CLIENT_PK = process.env.CLIENT_PK?.trim();

  const missing: string[] = [];
  if (!RPC) missing.push("ESCROW_RPC_URL");
  if (!FACTORY || !FACTORY.startsWith("0x")) missing.push("FACTORY_ADDRESS");
  if (!CLIENT_PK || !CLIENT_PK.startsWith("0x")) missing.push("CLIENT_PK");

  if (missing.length) {
    throw new Error(
      `Missing or invalid env: ${missing.join(", ")}. Copy apps/web/.env.example to .env.local and set values.`
    );
  }

  // Use same key for both roles so one wallet can fund, submit, approve, claim (testing/demo)
  const pk = CLIENT_PK as `0x${string}`;
  return {
    RPC,
    FACTORY: FACTORY as `0x${string}`,
    CLIENT_PK: pk,
    PROVIDER_PK: pk,
  };
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length) {
    throw new Error(
      `Missing env: ${missing.join(", ")}. Copy apps/web/.env.example to .env.local and set Supabase values.`
    );
  }

  return { url, anonKey };
}
