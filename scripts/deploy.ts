import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "MON"
  );

  // 1. Deploy AgentNFT (soulbound dynamic NFT)
  console.log("\n[1/3] Deploying AgentNFT...");
  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const nft = await AgentNFT.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("AgentNFT deployed to:", nftAddr);

  // 2. Deploy BattleArena
  console.log("\n[2/3] Deploying BattleArena...");
  const BattleArena = await ethers.getContractFactory("BattleArena");
  const arena = await BattleArena.deploy(nftAddr);
  await arena.waitForDeployment();
  const arenaAddr = await arena.getAddress();
  console.log("BattleArena deployed to:", arenaAddr);

  // 3. Link: tell AgentNFT who the BattleArena is
  console.log("\n[3/3] Linking contracts...");
  const tx = await nft.setBattleArena(arenaAddr);
  await tx.wait();
  console.log("BattleArena linked to AgentNFT");

  // Update .env.local with deployed addresses
  const envPath = path.join(__dirname, "../.env.local");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const setEnvVar = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    return regex.test(content)
      ? content.replace(regex, `${key}=${value}`)
      : content + `\n${key}=${value}`;
  };

  envContent = setEnvVar(envContent, "NEXT_PUBLIC_AGENT_NFT_ADDRESS", nftAddr);
  envContent = setEnvVar(envContent, "NEXT_PUBLIC_BATTLE_ARENA_ADDRESS", arenaAddr);
  // Keep backward compat key pointing to NFT contract
  envContent = setEnvVar(envContent, "NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS", nftAddr);
  fs.writeFileSync(envPath, envContent.trim() + "\n");

  console.log("\n✅ Deployment complete!");
  console.log("   AgentNFT:    ", nftAddr);
  console.log("   BattleArena: ", arenaAddr);
  console.log("\n.env.local updated. Run `npm run dev` to start the frontend.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
