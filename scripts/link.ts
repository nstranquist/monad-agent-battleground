/**
 * link.ts — Call setBattleArena on the already-deployed AgentNFT.
 * Run when the deploy script deployed contracts but the link tx failed.
 *
 * Usage:
 *   npx hardhat run scripts/link.ts --network monad
 */

import { ethers } from "hardhat";

async function main() {
  const nftAddr   = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS;
  const arenaAddr = process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS;
  if (!nftAddr || !arenaAddr) {
    throw new Error("Set NEXT_PUBLIC_AGENT_NFT_ADDRESS and NEXT_PUBLIC_BATTLE_ARENA_ADDRESS in .env.local first");
  }

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("AgentNFT:   ", nftAddr);
  console.log("BattleArena:", arenaAddr);

  const nft = await ethers.getContractAt("AgentNFT", nftAddr, signer);

  const current = await nft.battleArena();
  if (current.toLowerCase() === arenaAddr.toLowerCase()) {
    console.log("✅ Already linked — nothing to do.");
    return;
  }
  if (current !== "0x0000000000000000000000000000000000000000") {
    throw new Error(`battleArena already set to a different address: ${current}`);
  }

  console.log("\nCalling setBattleArena...");
  const tx = await nft.setBattleArena(arenaAddr);
  console.log("tx:", tx.hash);
  await tx.wait();

  const verified = await nft.battleArena();
  console.log("\n✅ Linked! battleArena() =", verified);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
