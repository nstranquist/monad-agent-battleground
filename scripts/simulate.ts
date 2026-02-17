/**
 * simulate.ts — Spin up test wallets, mint agents, run battles on Monad testnet.
 *
 * Usage:
 *   npx hardhat run scripts/simulate.ts --network monad
 *
 * Requires DEPLOYER_PRIVATE_KEY in .env.local with enough MON to fund wallets.
 * Each test wallet needs ~0.01 MON (gas + stakes).
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
  const nftAddress    = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS || process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS;
  const arenaAddress  = process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS;

  if (!nftAddress || !arenaAddress) {
    console.error("❌ Contract addresses not set. Run `npm run deploy:testnet` first.");
    process.exit(1);
  }

  const nft   = await ethers.getContractAt("AgentNFT",    nftAddress);
  const arena = await ethers.getContractAt("BattleArena", arenaAddress);
  const stake = await arena.BATTLE_STAKE();

  console.log("AgentNFT:   ", nftAddress);
  console.log("BattleArena:", arenaAddress);
  console.log("Stake:      ", ethers.formatEther(stake), "MON per side\n");

  // --- Create test wallets ---
  console.log("Creating", BUILDS.length, "test wallets...");
  const wallets = BUILDS.map(() => ethers.Wallet.createRandom().connect(provider));

  // Fund each wallet from deployer
  const fundAmount = ethers.parseEther("0.02"); // 0.02 MON each (gas + 10 battles)
  for (const wallet of wallets) {
    const tx = await deployer.sendTransaction({ to: wallet.address, value: fundAmount });
    await tx.wait();
    console.log("  Funded:", wallet.address, "→", ethers.formatEther(fundAmount), "MON");
  }
  console.log();

  // --- Mint agents ---
  console.log("Minting agents...");
  const agentIds: bigint[] = [];
  for (let i = 0; i < BUILDS.length; i++) {
    const { name, str, spd, int: intel } = BUILDS[i];
    const wallet = wallets[i];
    const nftConnected = nft.connect(wallet) as typeof nft;
    const tx = await nftConnected.mint(
      name,
      str,
      spd,
      intel,
      PERSONALITIES[i]
    );
    const receipt = await tx.wait();
    // Parse AgentMinted event
    const event = receipt?.logs
      .map((log) => { try { return nft.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "AgentMinted");
    const tokenId: bigint = event?.args?.tokenId ?? BigInt(i + 1);
    agentIds.push(tokenId);
    console.log(`  Minted: ${name} (token #${tokenId}) STR${str}/SPD${spd}/INT${intel}`);
  }
  console.log();

  // --- Run battles ---
  const battles = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
    [0, 2], [1, 3],
  ];

  console.log("Running", battles.length, "battles...\n");
  let wins: Record<string, number> = {};
  BUILDS.forEach((b) => (wins[b.name] = 0));

  for (const [aIdx, bIdx] of battles) {
    const walletA = wallets[aIdx];
    const walletB = wallets[bIdx];
    const agentA  = agentIds[aIdx];
    const agentB  = agentIds[bIdx];
    const nameA   = BUILDS[aIdx].name;
    const nameB   = BUILDS[bIdx].name;

    // A challenges B
    const arenaA = arena.connect(walletA) as typeof arena;
    const arenaB = arena.connect(walletB) as typeof arena;

    const challengeTx = await arenaA.challenge(agentA, agentB, { value: stake });
    const challengeReceipt = await challengeTx.wait();
    const battleEvent = challengeReceipt?.logs
      .map((log) => { try { return arena.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "BattleCreated");
    const battleId: bigint = battleEvent?.args?.battleId ?? BigInt(0);

    // B accepts
    const acceptTx = await arenaB.acceptChallenge(battleId, { value: stake });
    const acceptReceipt = await acceptTx.wait();
    const resolveEvent = acceptReceipt?.logs
      .map((log) => { try { return arena.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === "BattleResolved");

    const winnerAgentId: bigint = resolveEvent?.args?.winnerAgentId ?? BigInt(0);
    const winnerName = winnerAgentId === agentA ? nameA : nameB;
    const loserName  = winnerAgentId === agentA ? nameB : nameA;
    wins[winnerName] = (wins[winnerName] || 0) + 1;

    console.log(`  Battle #${battleId}: ${nameA} vs ${nameB} → 🏆 ${winnerName} beats ${loserName}`);
  }

  // --- Final standings ---
  console.log("\n📊 Final Standings:");
  const standings = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  for (const [name, w] of standings) {
    const agent = await nft.getAgent(agentIds[BUILDS.findIndex((b) => b.name === name)]);
    console.log(`  ${name.padEnd(14)} ${w}W-${agent.losses}L  (${BUILDS.find(b=>b.name===name)?.str}/${BUILDS.find(b=>b.name===name)?.spd}/${BUILDS.find(b=>b.name===name)?.int} STR/SPD/INT)`);
  }

  console.log("\n✅ Simulation complete. Check", arenaAddress, "on the explorer.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
