export const escrowAbi = [
  { "type":"function","name":"client","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}] },
  { "type":"function","name":"provider","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}] },
  { "type":"function","name":"funded","stateMutability":"view","inputs":[],"outputs":[{"type":"bool"}] },
  { "type":"function","name":"totalAmount","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}] },
  { "type":"function","name":"milestonesCount","stateMutability":"view","inputs":[],"outputs":[{"type":"uint256"}] },
  {
    "type":"function","name":"getMilestone","stateMutability":"view",
    "inputs":[{"type":"uint256","name":"i"}],
    "outputs":[{
      "type":"tuple",
      "components":[
        {"type":"uint256","name":"amount"},
        {"type":"uint64","name":"deadline"},
        {"type":"uint8","name":"status"},
        {"type":"string","name":"proofURI"},
        {"type":"string","name":"reasonURI"},
        {"type":"uint64", "name": "submittedAt" }
      ]
    }]
  },
  { "type":"function","name":"fund","stateMutability":"payable","inputs":[],"outputs":[] },
  { "type":"function","name":"submit","stateMutability":"nonpayable","inputs":[{"type":"uint256","name":"i"},{"type":"string","name":"proofURI"}],"outputs":[] },
  { "type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"type":"uint256","name":"i"}],"outputs":[] },
  { "type":"function","name":"reject","stateMutability":"nonpayable","inputs":[{"type":"uint256","name":"i"},{"type":"string","name":"reasonURI"}],"outputs":[] },
  { "type":"function","name":"claim","stateMutability":"nonpayable","inputs":[{"type":"uint256","name":"i"}],"outputs":[] }
] as const;

export const statusLabel = (s: number) =>
  ["Pending","Submitted","Approved","Rejected","Paid", "Claimed"][s] ?? `Unknown(${s})`;
