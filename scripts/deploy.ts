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

  // Deploy AgentRegistry
  console.log("\n[1/3] Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgentRegistry deployed to:", registryAddr);

  // Deploy BattleArena
  console.log("\n[2/3] Deploying BattleArena...");
  const BattleArena = await ethers.getContractFactory("BattleArena");
  const arena = await BattleArena.deploy(registryAddr);
  await arena.waitForDeployment();
  const arenaAddr = await arena.getAddress();
  console.log("BattleArena deployed to:", arenaAddr);

  // Link contracts
  console.log("\n[3/3] Linking contracts...");
  const tx = await registry.setBattleArena(arenaAddr);
  await tx.wait();
  console.log("BattleArena linked to AgentRegistry");

  // Write addresses to .env.local
  const envPath = path.join(__dirname, "../.env.local");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  const updateEnv = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content + `\n${key}=${value}`;
  };

  envContent = updateEnv(
    envContent,
    "NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS",
    registryAddr
  );
  envContent = updateEnv(
    envContent,
    "NEXT_PUBLIC_BATTLE_ARENA_ADDRESS",
    arenaAddr
  );
  fs.writeFileSync(envPath, envContent.trim() + "\n");

  console.log("\n✅ Deployment complete!");
  console.log("   AgentRegistry:", registryAddr);
  console.log("   BattleArena:  ", arenaAddr);
  console.log("\n.env.local updated with contract addresses.");
  console.log("Run `npm run dev` to start the frontend.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
