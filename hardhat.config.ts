import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    monad: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY &&
        process.env.DEPLOYER_PRIVATE_KEY.length === 64
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
