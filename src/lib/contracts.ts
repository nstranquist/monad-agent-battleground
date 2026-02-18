// ── Testnet (chain 10143) ─────────────────────────────────────────────────────
export const AGENT_NFT_ADDRESS = (process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS ||
  process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ||
  "") as `0x${string}`;

export const BATTLE_ARENA_ADDRESS = (process.env
  .NEXT_PUBLIC_BATTLE_ARENA_ADDRESS || "") as `0x${string}`;

// ── Mainnet (chain 143) ───────────────────────────────────────────────────────
export const AGENT_NFT_ADDRESS_MAINNET = (process.env
  .NEXT_PUBLIC_AGENT_NFT_ADDRESS_MAINNET || "") as `0x${string}`;

export const BATTLE_ARENA_ADDRESS_MAINNET = (process.env
  .NEXT_PUBLIC_BATTLE_ARENA_ADDRESS_MAINNET || "") as `0x${string}`;

// ── Chain-aware address resolver ──────────────────────────────────────────────
export function getContractAddresses(chainId: number) {
  const isMainnet = chainId === 143;
  return {
    agentNftAddress: isMainnet ? AGENT_NFT_ADDRESS_MAINNET : AGENT_NFT_ADDRESS,
    battleArenaAddress: isMainnet
      ? BATTLE_ARENA_ADDRESS_MAINNET
      : BATTLE_ARENA_ADDRESS,
    explorerUrl: isMainnet
      ? "https://explorer.monad.xyz"
      : "https://testnet.monadexplorer.com",
    networkLabel: isMainnet ? "Monad Mainnet" : "Monad Testnet",
  };
}

// ── Backward-compat aliases ───────────────────────────────────────────────────
export const AGENT_REGISTRY_ADDRESS = AGENT_NFT_ADDRESS;
export const BATTLE_STAKE = BigInt("1000000000000000"); // 0.001 MON

// ─── AgentNFT ABI ─────────────────────────────────────────────────────────────

export const AGENT_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "name", type: "string" },
      { name: "strength", type: "uint8" },
      { name: "speed", type: "uint8" },
      { name: "intelligence", type: "uint8" },
      { name: "personalityPrompt", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updatePersonality",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "prompt", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "owner", type: "address" },
          { name: "strength", type: "uint8" },
          { name: "speed", type: "uint8" },
          { name: "intelligence", type: "uint8" },
          { name: "personalityPrompt", type: "string" },
          { name: "wins", type: "uint256" },
          { name: "losses", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllAgentIds",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOwnerAgents",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAgents",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "str", type: "uint8", indexed: false },
      { name: "spd", type: "uint8", indexed: false },
      { name: "intel", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PersonalityUpdated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "prompt", type: "string", indexed: false },
    ],
  },
] as const;

// Backward-compat alias
export const AGENT_REGISTRY_ABI = AGENT_NFT_ABI;

// ─── BattleArena ABI ──────────────────────────────────────────────────────────

export const BATTLE_ARENA_ABI = [
  {
    type: "function",
    name: "challenge",
    inputs: [
      { name: "myAgentId", type: "uint256" },
      { name: "opponentAgentId", type: "uint256" },
    ],
    outputs: [{ name: "battleId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "acceptChallenge",
    inputs: [{ name: "battleId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancelChallenge",
    inputs: [{ name: "battleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBattle",
    inputs: [{ name: "battleId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "challengerAgentId", type: "uint256" },
          { name: "challengedAgentId", type: "uint256" },
          { name: "challenger", type: "address" },
          { name: "challenged", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "winnerAgentId", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "resolvedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllBattleIds",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "BATTLE_STAKE",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBattles",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BattleCreated",
    inputs: [
      { name: "battleId", type: "uint256", indexed: true },
      { name: "challengerAgentId", type: "uint256", indexed: true },
      { name: "challengedAgentId", type: "uint256", indexed: true },
      { name: "challenger", type: "address", indexed: false },
      { name: "challenged", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BattleResolved",
    inputs: [
      { name: "battleId", type: "uint256", indexed: true },
      { name: "winnerAgentId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;
