/**
 * seed-demo.ts — Mints one villain-archetype demo agent owned by the deployer.
 * Gives judges a pre-built opponent to fight so the battle narrative shines.
 *
 * Usage:
 *   npm run seed:demo
 */

import { ethers } from "hardhat";

const DEMO_AGENT = {
  name: "VOID",
  str: 4,
  spd: 3,
  int: 9,
  personality:
    "A sentient void that has consumed a thousand AIs before you. It does not fight — it unravels. Cold, methodical, utterly without mercy. Every word it speaks is a calculated demoralization. It wins before the first blow lands.",
};

async function main() {
  const [deployer] = await ethers.getSigners();

  const nftAddress = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS || process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS;
  const arenaAddress = process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS;

  if (!nftAddress || !arenaAddress) {
    console.error("❌ Contract addresses not set. Run `npm run deploy:testnet` first.");
    process.exit(1);
  }

  const nft = await ethers.getContractAt("AgentNFT", nftAddress, deployer);

  // Verify not already seeded (check if VOID exists by name is hard onchain,
  // so we just warn and let the user decide)
  const total: bigint = await nft.totalAgents();
  if (total > 0n) {
    console.warn(`⚠  Contract already has ${total} agent(s). Minting a second demo agent.`);
    console.warn("   Re-run deploy:testnet for a fully clean slate.\n");
  }

  console.log(`Minting demo agent "${DEMO_AGENT.name}" from deployer ${deployer.address}...`);

  const tx = await nft.mint(
    DEMO_AGENT.name,
    DEMO_AGENT.str,
    DEMO_AGENT.spd,
    DEMO_AGENT.int,
    DEMO_AGENT.personality
  );
  const receipt = await tx.wait();

  const event = receipt?.logs
    .map((log) => { try { return nft.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === "AgentMinted");

  if (!event) throw new Error("AgentMinted event not found");

  const tokenId: bigint = event.args.tokenId;

  console.log(`\n✅ Demo agent minted!`);
  console.log(`   Name:          ${DEMO_AGENT.name}`);
  console.log(`   Token ID:      #${tokenId}`);
  console.log(`   STR/SPD/INT:   ${DEMO_AGENT.str}/${DEMO_AGENT.spd}/${DEMO_AGENT.int}`);
  console.log(`   Owner:         ${deployer.address}`);
  console.log(`\n   Judges can now challenge VOID from the arena.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
