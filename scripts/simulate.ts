/**
 * simulate.ts — Deployer mints all agents, runs battles onchain.
 * Using a single deployer signer avoids hardhat-ethers random-wallet signer bugs.
 *
 * Usage:
 *   npm run simulate
 */

import { ethers } from "hardhat";

const PERSONALITIES = [
  "Ruthless efficiency. No mercy, no hesitation.",
  "Ancient wisdom guides every move. Patient, precise.",
  "Pure aggression. First hit, last breath.",
  "Silent and calculating. Strikes once, ends it.",
  "Chaotic energy. Unpredictable, loves the crowd.",
];

const BUILDS = [
  { name: "IronFist",   str: 8, spd: 1, int: 1 }, // Berserker
  { name: "VoltRush",   str: 1, spd: 8, int: 1 }, // Speedster
  { name: "OracleZero", str: 1, spd: 1, int: 8 }, // Oracle
  { name: "Phantom4",   str: 2, spd: 5, int: 3 }, // Phantom
  { name: "Tactician",  str: 3, spd: 3, int: 4 }, // Sage
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "MON\n");

  // --- Attach to deployed contracts ---
  const nftAddress   = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS || process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS;
  const arenaAddress = process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS;

  if (!nftAddress || !arenaAddress) {
    console.error("❌ Contract addresses not set. Run `npm run deploy:testnet` first.");
    process.exit(1);
  }

  const nft   = await ethers.getContractAt("AgentNFT",    nftAddress,    deployer);
  const arena = await ethers.getContractAt("BattleArena", arenaAddress,  deployer);
  const stake = await arena.BATTLE_STAKE();

  console.log("AgentNFT:   ", nftAddress);
  console.log("BattleArena:", arenaAddress);
  console.log("Stake:      ", ethers.formatEther(stake), "MON per side\n");

  // Verify link
  const linkedArena = await nft.battleArena();
  if (linkedArena.toLowerCase() !== arenaAddress.toLowerCase()) {
    console.error("❌ AgentNFT is not linked to BattleArena. Run `npm run link` first.");
    console.error("   battleArena() =", linkedArena);
    process.exit(1);
  }
  console.log("✅ Contracts linked\n");

  // --- Mint agents (deployer is signer → deployer owns all agents) ---
  console.log("Minting", BUILDS.length, "agents from deployer...");
  const agentIds: bigint[] = [];
  for (let i = 0; i < BUILDS.length; i++) {
    const { name, str, spd, int: intel } = BUILDS[i];
    const tx = await nft.mint(name, str, spd, intel, PERSONALITIES[i]);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((log) => { try { return nft.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "AgentMinted");
    if (!event) throw new Error(`AgentMinted event not found for ${name}`);
    const tokenId: bigint = event.args.tokenId;
    agentIds.push(tokenId);
    console.log(`  Minted: ${name} (token #${tokenId}) STR${str}/SPD${spd}/INT${intel}`);
  }
  console.log();

  // --- Run battles (deployer owns all agents → can challenge + accept) ---
  const battles = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
    [0, 2], [1, 3],
  ];

  console.log("Running", battles.length, "battles...\n");
  const wins: Record<string, number> = {};
  BUILDS.forEach((b) => (wins[b.name] = 0));

  let battleNum = 0;
  for (const [aIdx, bIdx] of battles) {
    battleNum++;
    const agentA = agentIds[aIdx];
    const agentB = agentIds[bIdx];
    const nameA  = BUILDS[aIdx].name;
    const nameB  = BUILDS[bIdx].name;

    // Challenge (explicit gas limit; Monad testnet gas estimation can be off)
    const challengeTx = await arena.challenge(agentA, agentB, { value: stake, gasLimit: 500_000 });
    const challengeReceipt = await challengeTx.wait();
    const battleEvent = challengeReceipt?.logs
      .map((log) => { try { return arena.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "BattleCreated");
    if (!battleEvent) throw new Error(`BattleCreated event not found for battle ${battleNum}`);
    const battleId: bigint = battleEvent.args.battleId;

    // Accept (deployer also owns the challenged agent → valid)
    // Dry-run first to surface revert reasons
    try {
      await arena.acceptChallenge.staticCall(battleId, { value: stake });
    } catch (staticErr: unknown) {
      const msg = staticErr instanceof Error ? staticErr.message : String(staticErr);
      console.error(`  ❌ staticCall failed for acceptChallenge(battleId=${battleId}):`, msg);
      throw staticErr;
    }
    const acceptTx = await arena.acceptChallenge(battleId, { value: stake, gasLimit: 500_000 });
    const acceptReceipt = await acceptTx.wait();
    const resolveEvent = acceptReceipt?.logs
      .map((log) => { try { return arena.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "BattleResolved");
    if (!resolveEvent) throw new Error(`BattleResolved event not found for battle ${battleNum}`);

    const winnerAgentId: bigint = resolveEvent.args.winnerAgentId;
    const winnerName = winnerAgentId === agentA ? nameA : nameB;
    const loserName  = winnerAgentId === agentA ? nameB : nameA;
    wins[winnerName] = (wins[winnerName] || 0) + 1;

    console.log(`  Battle #${battleId}: ${nameA} vs ${nameB} → 🏆 ${winnerName} beats ${loserName}`);
  }

  // --- Final standings ---
  console.log("\n📊 Final Standings:");
  const standings = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  for (const [name, w] of standings) {
    const idx   = BUILDS.findIndex((b) => b.name === name);
    const agent = await nft.getAgent(agentIds[idx]);
    const build = BUILDS[idx];
    console.log(`  ${name.padEnd(14)} ${w}W-${agent.losses}L  (${build.str}/${build.spd}/${build.int} STR/SPD/INT)`);
  }

  const endBal = await provider.getBalance(deployer.address);
  console.log("\n✅ Simulation complete! Check", arenaAddress, "on the explorer.");
  console.log("   Deployer balance remaining:", ethers.formatEther(endBal), "MON");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
