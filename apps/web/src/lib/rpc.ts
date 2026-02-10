/**
 * Single RPC source for client-side use (e.g. waitForTransactionReceipt).
 * Set NEXT_PUBLIC_ESCROW_RPC_URL in .env.local to match server ESCROW_RPC_URL, or leave unset for default.
 */
const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia.publicnode.com";

export function getClientRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ESCROW_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC;
}
