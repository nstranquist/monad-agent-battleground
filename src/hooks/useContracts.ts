"use client";

import { useChainId } from "wagmi";
import { getContractAddresses, AGENT_NFT_ABI, BATTLE_ARENA_ABI, BATTLE_STAKE } from "@/lib/contracts";

export function useContracts() {
  const chainId = useChainId();
  const { agentNftAddress, battleArenaAddress, explorerUrl, networkLabel } =
    getContractAddresses(chainId);

  return {
    agentNftAddress,
    agentNftAbi: AGENT_NFT_ABI,
    battleArenaAddress,
    battleArenaAbi: BATTLE_ARENA_ABI,
    battleStake: BATTLE_STAKE,
    explorerUrl,
    networkLabel,
    isMainnet: chainId === 143,
    chainId,
  };
}
