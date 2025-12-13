export const factoryAbi = [
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { indexed: true, name: "escrow", type: "address" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "provider", type: "address" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "client", type: "address" },
      { name: "provider", type: "address" },
      { name: "amounts", type: "uint256[]" },
      { name: "deadlines", type: "uint64[]" },
    ],
    outputs: [{ name: "escrow", type: "address" }],
  },
] as const;
