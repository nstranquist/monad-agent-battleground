# Architecture & Tech Stack — Agent Battle Arena

## Overview

Onchain skill-based battle game on Monad. Players mint a soulbound dynamic NFT champion,
customize its personality and stat build, stake MON, challenge opponents, and watch battles
resolve in milliseconds. Claude generates a unique narrative for every fight using the
agent's custom prompt.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Browser                            │
│                                                             │
│   Next.js 15 (App Router)                                   │
│   ├── /              Landing page                           │
│   ├── /create        Agent creation, stat build, prompt     │
│   ├── /agent/[id]    Champion card (dynamic NFT view)       │
│   ├── /arena         Challenge + accept + battle sim        │
│   └── /leaderboard   Live onchain rankings                  │
│                                                             │
│   Wagmi v2 + Viem  ────────────────────────────────────┐    │
│   RainbowKit v2 (Phantom as primary wallet)            │    │
└───────────────────────────────────────────────────────-┼────┘
                                                         │
                       JSON-RPC (viem)                   │
                                                         ▼
┌────────────────────────────────────────────────────────────┐
│                Monad Testnet (Chain ID: 10143)              │
│                10,000+ TPS · <1s finality · EVM            │
│                                                            │
│   AgentNFT.sol  (replaces AgentRegistry)                   │
│   ├── ERC-721 base — shows up in wallets, has tokenURI     │
│   ├── SOULBOUND — transfer/approve overridden to revert    │
│   ├── mint(name, str, spd, int, personality)               │
│   ├── updatePersonality(tokenId, string)  ← owner only     │
│   ├── tokenURI(tokenId) → onchain SVG (stats + W/L)        │
│   └── recordBattleResult(winnerId, loserId) ← onlyArena    │
│                                                            │
│   BattleArena.sol                                          │
│   ├── challenge(myAgentId, opponentAgentId)  payable       │
│   ├── acceptChallenge(battleId)              payable       │
│   │     └── _resolveBattle() inline                       │
│   │           ├── pseudo-random via blockhash + stats      │
│   │           ├── nft.recordBattleResult()                 │
│   │           └── payable(winner).transfer(payout)         │
│   └── cancelChallenge(battleId)  after 1h                  │
└────────────────────────────────────────────────────────────┘
                           │
               Next.js API Route (/api/narrative)
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│         Anthropic API (Claude Haiku 4.5)             │
│         Reads agent personality prompt from chain    │
│         Generates battle narrative ~300ms            │
└──────────────────────────────────────────────────────┘
```

---

## The Agent Token: Soulbound Dynamic NFT

### ERC-721 vs Soulbound — The Difference

| | ERC-721 (standard) | Soulbound |
|--|--|--|
| Shows in wallet | ✅ | ✅ |
| Has tokenURI / image | ✅ | ✅ |
| Can be sold/transferred | ✅ | ❌ (reverts) |
| Can be bought by someone else | ✅ | ❌ |
| Tied to creator forever | ❌ | ✅ |

### What We're Building: Both

We use ERC-721 as the infrastructure (so it shows up in Phantom, has metadata,
renders in explorers) but override the transfer functions to revert. The result:

- Your champion appears as an NFT in your Phantom wallet
- Its art and stats are generated fully onchain (no IPFS, no external metadata)
- The image literally changes as your W/L record grows
- You can NEVER sell it — it's your identity, not a commodity
- The agent's personality prompt is stored onchain and used by Claude in every battle

### Onchain SVG Card (what the NFT looks like)

```
┌──────────────────────────┐
│  ⚔  SHADOWPULSE          │
│     BERSERKER CLASS      │
│                          │
│  STR  ████████░░  8      │
│  SPD  ██░░░░░░░░  2      │
│  INT  ░░░░░░░░░░  0      │  <- wait, sum = 10
│                          │
│  ████  12W  ·  3L        │
│  "I fight with no mercy" │  <- personality (truncated)
│                          │
│  RANK #4  · Monad Chain  │
└──────────────────────────┘
```

SVG is assembled in `tokenURI()` — pure Solidity string concatenation.
No IPFS. The token IS the data. Updates live on every win/loss.

### Customization

Players can set and update their agent's `personalityPrompt` (max 200 chars) — a
short string that influences how Claude writes their battle narratives. Examples:

- `"I fight dirty and talk trash. Never backs down."`
- `"Silent, calculating. Strikes once, ends it."`
- `"Chaotic energy, unpredictable, loves the crowd."`

This is stored onchain. Every narrative call reads it and passes it to Claude.

---

## Tech Stack

### Contracts
| Tool | Version | Why |
|--|--|--|
| Solidity | 0.8.24 | Latest stable |
| Hardhat | ^2.22 | TS-native, easy scripts, already working |
| OpenZeppelin | ^5 | ERC-721 base, battle-tested |

### Frontend
| Library | Version | Why |
|--|--|--|
| Next.js | 15 (App Router) | SSR + API routes in one project |
| Viem | v2 | Best-in-class EVM TS client |
| Wagmi | v2 | Best React hooks for EVM |
| RainbowKit | v2 | Wallet UI — Phantom configured as primary |
| Tailwind CSS | v3 | Fast UI iteration |
| Three.js / React Three Fiber | latest | Battle visualization (planned) |
| @tanstack/react-query | v5 | Required by wagmi v2 |

### AI
| Library | Model | Why |
|--|--|--|
| @anthropic-ai/sdk | claude-haiku-4-5-20251001 | ~300ms latency, ~$0.0006/battle |

### Wallet
- **Phantom** — explicitly configured in RainbowKit as primary. Supports Monad Testnet
  as EVM chain. Users need to add Monad Testnet (Chain ID 10143) manually once.

---

## Off-chain vs On-chain Split

### On-chain (trustless, permanent)
- Agent identity: name, stats, owner, personality prompt
- Agent record: wins, losses (updated by BattleArena only)
- Agent NFT: tokenURI / onchain SVG card
- Battle: creation, stakes, resolution, prize payout
- Leaderboard state: all derived from contract reads

### Off-chain (display/entertainment, not trustless)
- Frontend UI
- Battle narrative text (Claude API) — entertaining but not outcome-critical
- Battle visualization / animation (Three.js)
- Wallet connection (RainbowKit/Phantom)

The outcome (who wins, who gets paid) is 100% onchain. Claude is just storytelling.

---

## Security Analysis

### Strong
- `setBattleArena()` callable once — can't be hijacked post-deploy
- `onlyBattleArena` on `recordBattleResult` — only arena updates W/L
- `onlyTokenOwner` on `updatePersonality` — you can only edit your own agent
- Checks-effects-interactions in `_resolveBattle` — state written before ETH transfer
- Soulbound prevents agent marketplace/farming abuse

### Known Weaknesses (acceptable for hackathon)
- **Blockhash randomness** — validator could see outcome before accepting. Fix: Chainlink
  VRF or commit-reveal in production.
- **No `/api/narrative` auth** — spam could run up Claude costs. Fix: per-address rate
  limit, require a valid tx hash.
- **No agent creation limit** — address can mint unlimited agents. Fix: small creation
  fee or 1-per-address limit.

---

## Battle Resolution

```
seed = keccak256(blockhash(n-1) + battleId + agentIds + timestamp)

scoreA = (strength × rand1_1-10) + (speed × rand2_1-10) + (intelligence × rand3_1-10)
scoreB = (strength × rand1'_1-10) + (speed × rand2'_1-10) + (intelligence × rand3'_1-10)
winner = scoreA >= scoreB ? agentA : agentB
```

Higher stats → higher expected score. Randomness preserves excitement.
One tx: challenge accepted → battle resolved → prize paid → records updated.

---

## Data Flow: Full Battle

```
1. Player A: challenge(myAgentId, opponentId) + 0.001 MON stake
   └── BattleCreated event

2. Player B: acceptChallenge(battleId) + 0.001 MON stake
   └── _resolveBattle() atomically:
       ├── seed from blockhash + ids
       ├── scores computed
       ├── nft.recordBattleResult(winner, loser)  → SVG updates
       ├── winner.transfer(0.0019 MON)
       └── BattleResolved event

3. Frontend: tx confirmed → POST /api/narrative { battleId }
   └── reads battle + agents + personalityPrompts from chain
       └── Claude Haiku: narrative using both agents' personalities (~300ms)
           └── Rendered with animation in UI
```

**Total time: ~1-2 seconds** (Monad <1s finality + Haiku ~300ms)

---

## Claude Cost Estimate

Model: `claude-haiku-4-5-20251001`

Input now includes agent personality prompts (~+50 tokens each):

| | Tokens | Cost |
|--|--|--|
| Input (prompt + stats + personalities) | ~300 | ~$0.00024 |
| Output (narrative ~100 words) | ~130 | ~$0.00052 |
| **Total per battle** | ~430 | **~$0.00076** |

| Scale | Battles | Claude Cost |
|--|--|--|
| Hackathon demo (today) | 50 | ~$0.04 |
| 100 users, 20 battles each | 2,000 | ~$1.52 |
| 10,000 battles | 10,000 | ~$7.60 |
| 1M battles | 1,000,000 | ~$760 |

Still negligible. Add rate limiting before sharing URL publicly.

---

## Test Wallet Simulation

A Hardhat script (`scripts/simulate.ts`) can:
1. Spin up N funded wallets from deployer
2. Mint agents for each with random builds + personalities
3. Run N battles between them
4. Print outcomes + check contract state

Run: `npx hardhat run scripts/simulate.ts --network monad`

---

## Submission

Fork: https://github.com/nstranquist/monad-blitz-denver
Submit: https://blitz.devnads.com/events/monad-blitz-denver-2026
