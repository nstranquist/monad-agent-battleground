export interface Agent {
  id: bigint;
  name: string;
  owner: `0x${string}`;
  strength: number;
  speed: number;
  intelligence: number;
  wins: bigint;
  losses: bigint;
  createdAt: bigint;
  exists: boolean;
}

export interface Battle {
  id: bigint;
  challengerAgentId: bigint;
  challengedAgentId: bigint;
  challenger: `0x${string}`;
  challenged: `0x${string}`;
  stake: bigint;
  status: number; // 0=Pending, 1=Completed, 2=Cancelled
  winnerAgentId: bigint;
  createdAt: bigint;
  resolvedAt: bigint;
}

export const BATTLE_STATUS = {
  0: "Pending",
  1: "Completed",
  2: "Cancelled",
} as const;
