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

  console.log("\nDeploying NarrativeRegistry...");
  const NarrativeRegistry = await ethers.getContractFactory("NarrativeRegistry");
  const registry = await NarrativeRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("NarrativeRegistry deployed to:", registryAddr);
  console.log("Authority set to deployer:", deployer.address);

  // Update .env.local
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 143n;

  const envPath = path.join(__dirname, "../.env.local");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const setEnvVar = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    return regex.test(content)
      ? content.replace(regex, `${key}=${value}`)
      : content + `\n${key}=${value}`;
  };

  const envKey = isMainnet
    ? "NEXT_PUBLIC_NARRATIVE_REGISTRY_ADDRESS_MAINNET"
    : "NEXT_PUBLIC_NARRATIVE_REGISTRY_ADDRESS";

  envContent = setEnvVar(envContent, envKey, registryAddr);
  // Also store for server-side (non-public) use
  const serverKey = isMainnet
    ? "NARRATIVE_REGISTRY_ADDRESS_MAINNET"
    : "NARRATIVE_REGISTRY_ADDRESS";
  envContent = setEnvVar(envContent, serverKey, registryAddr);

  fs.writeFileSync(envPath, envContent.trim() + "\n");

  console.log("\n✅ NarrativeRegistry deployed!");
  console.log("   Address:", registryAddr);
  console.log("   .env.local updated with", envKey);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
