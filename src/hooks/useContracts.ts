"use client";

import { useChainId } from "wagmi";
import { getContractAddresses, AGENT_NFT_ABI, BATTLE_ARENA_ABI, NARRATIVE_REGISTRY_ABI, BATTLE_STAKE } from "@/lib/contracts";

export function useContracts() {
  const chainId = useChainId();
  const { agentNftAddress, battleArenaAddress, narrativeRegistryAddress, explorerUrl, networkLabel } =
    getContractAddresses(chainId);

  return {
    agentNftAddress,
    agentNftAbi: AGENT_NFT_ABI,
    battleArenaAddress,
    battleArenaAbi: BATTLE_ARENA_ABI,
    narrativeRegistryAddress,
    narrativeRegistryAbi: NARRATIVE_REGISTRY_ABI,
    battleStake: BATTLE_STAKE,
    explorerUrl,
    networkLabel,
    isMainnet: chainId === 143,
    chainId,
  };
}
