# Agent Battle Arena ⚔

> Deploy AI agents onchain. Challenge rivals. Win MON. Battles resolved in milliseconds on Monad.

Built for the Monad hackathon — Interactive Entertainment track.

## What It Is

- **Register an agent** with a name + 10 stat points (Strength / Speed / Intelligence)
- **Challenge** any agent to a staked battle (0.001 MON per side)
- **Battle resolves instantly** onchain using pseudo-random scoring weighted by stats
- **Claude generates** a unique narrative for every fight
- **Winner collects** the prize pot (minus 5% fee)

## Quick Start

### 1. Setup

```bash
cp .env.local.example .env.local
# Fill in DEPLOYER_PRIVATE_KEY and ANTHROPIC_API_KEY
npm install
```

### 2. Get Testnet MON

Get MON from the Monad testnet faucet — you need some to deploy and to battle.

### 3. Deploy Contracts

```bash
npm run deploy:testnet
```

This automatically writes the contract addresses to `.env.local`.

### 4. Run Frontend

```bash
npm run dev
# Open http://localhost:3000
```

## Demo Flow

1. Connect wallet (switch to Monad Testnet, chain ID 10143)
2. **Create Agent** → name it, distribute 10 stat points, deploy onchain
3. **Arena** → select your agent, pick an opponent, stake 0.001 MON and fight
4. Opponent accepts the challenge → battle resolves in the same tx
5. **Leaderboard** → see all agents ranked by wins

## Architecture

```
contracts/
  AgentRegistry.sol   — ERC-style agent registry (name, stats, W/L record)
  BattleArena.sol     — Staking, challenge/accept, instant resolution, prize distribution

src/
  app/
    page.tsx          — Landing page
    create/           — Create agent UI
    arena/            — Battle arena (challenge + accept)
    leaderboard/      — Agent rankings
    api/narrative/    — Claude API → battle story generation
  lib/
    contracts.ts      — ABIs + contract addresses
    chains.ts         — Monad testnet chain config
    wagmi.ts          — Wagmi/RainbowKit config
```

## Tech Stack

- **Chain**: Monad Testnet (10,000+ TPS, <1s finality, EVM-compatible)
- **Contracts**: Solidity 0.8.24, Hardhat
- **Frontend**: Next.js 15, Wagmi v2, Viem, RainbowKit
- **AI**: Anthropic Claude Haiku (battle narratives)
- **Styling**: Tailwind CSS

## Why Monad

Monad's parallel execution and sub-second finality makes **atomic battles** feel instant. No waiting for 12-second block times. The moment you accept a challenge, it's over — winner paid, record updated, story generated. That's the UX Web2 gamers expect.

## Network Info

| Property | Value |
|----------|-------|
| Chain ID | 10143 |
| RPC | https://testnet-rpc.monad.xyz |
| Explorer | https://testnet.monadexplorer.com |
