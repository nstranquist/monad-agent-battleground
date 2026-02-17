# Demo Considerations & Build Checklist

Everything that needs to be addressed before/during the demo.
Ordered by priority.

---

## 🔴 Critical — Must Have for Demo

### 1. Upgrade AgentRegistry → Soulbound Dynamic NFT
**What:** Replace `AgentRegistry.sol` (plain mapping) with `AgentNFT.sol` (ERC-721 soulbound)
**Why:** The most demoable thing we have — show judges a live NFT in Phantom that
updates its art as you win battles. Nothing else shows Monad's speed + onchain state
as clearly.
**What it adds:**
- `mint()` instead of `createAgent()` — same params + adds `personalityPrompt`
- `updatePersonality(tokenId, string)` — owner can edit anytime (gamification hook)
- `tokenURI()` — returns onchain SVG trading card, no IPFS
- Soulbound: `_beforeTokenTransfer` reverts on any transfer attempt
- `personalityPrompt` read by Claude API for narrative generation
**OpenZeppelin ERC721 base recommended for speed**

### 2. Agent Personality / Prompt Customization UI
**What:** Add a text field on `/create` and `/agent/[id]` for the personality prompt
**Why:** Core ask from CLAUDE.md — "let the user customize their agent prompt"
**UX:** 200 char limit, examples shown, live preview of how it affects the narrative
**Onchain:** `updatePersonality(tokenId, prompt)` — one tx, gas is minimal for a string
**Affects:** Claude narrative prompt is enriched with both agents' personalities

### 3. Phantom Wallet — RainbowKit Config Fix
**What:** Add `phantomWallet` explicitly to RainbowKit wallet list
**Why:** Currently shows as generic "injected" — bad first impression for demo
**Fix:** 5-line change in `src/lib/wagmi.ts`
**Also:** Add Monad Testnet setup instructions to the landing page for judges

### 4. Battle Visualization / Simulation
**What:** When a battle resolves, animate it rather than just showing text
**Why:** CLAUDE.md: "launch the battle and see it simulated"
**Options (pick one for hackathon):**
- **Simple (2h):** CSS/Tailwind animation — two agent cards "clash" with shake/flash effects,
  health bars drain frame by frame, winner card glows. No Three.js needed.
- **Full (4h+):** React Three Fiber — 3D arena, two glowing orbs collide, particle explosion
  on resolution. Impressive but risky on time.
**Recommendation:** Ship the CSS animation now. Three.js is a stretch goal.

---

## 🟡 Important — Strong to Have

### 5. Test Wallet Simulation Script
**What:** `scripts/simulate.ts` — spins up funded wallets, mints agents, runs battles
**Why:** CLAUDE.md asks for this. Also critical for testing before judges try it.
**How:**
```typescript
// pseudocode
const wallets = Array.from({length: 5}, () => generatePrivateKey())
// fund each from deployer
// mint agents with different builds
// run 10 battles between random pairs
// log outcomes, verify prize distribution
```
**Run:** `npx hardhat run scripts/simulate.ts --network monad`

### 6. `/agent/[id]` Champion Page
**What:** Individual page for each agent showing the dynamic NFT card, full battle history,
personality prompt, and a "Challenge" button
**Why:** Makes agents feel real and shareable — "here's my champion's page"
**URL:** `arena.example.com/agent/42` — shareable link = organic distribution

### 7. Rate Limiting on `/api/narrative`
**What:** Simple in-memory or Redis rate limit — max 10 calls per address per minute
**Why:** Prevents Claude bill abuse if URL gets shared
**Quick fix:** Check `x-forwarded-for` header, track in a Map, return 429 if over limit

---

## 🟢 Nice to Have — If Time Permits

### 8. Three.js Battle Arena Visualization
**What:** React Three Fiber scene — two agent orbs in a dark arena, stats shown as
glowing halos, they collide and explode on resolution
**Why:** Extremely demoable, makes the "game feel" argument much stronger
**Risk:** Time. Don't start this until 1-4 are done.
**Stack:** `@react-three/fiber` + `@react-three/drei` + `three`

### 9. Onchain Battle History on NFT Card
**What:** Show last 5 battle results on the SVG card (W/W/L/W/L streak display)
**Why:** Makes the NFT feel alive — every fight leaves a mark
**How:** Store last 5 outcomes in a `uint8` packed bitmask in the NFT contract

### 10. Agent Classes (derived from stat build)
**What:** Auto-assign a class name based on highest stat:
- STR dominant → BERSERKER
- SPD dominant → SPEEDSTER
- INT dominant → ORACLE
- Balanced → TACTICIAN / PHANTOM / SAGE
**Why:** Adds flavor, helps players feel like their build choice means something
**Where:** Pure frontend derivation from stats — no contract change needed

### 11. "Spectate" Mode
**What:** Anyone can watch a pending battle without a wallet — just view the arena
**Why:** Makes it work as a live demo without requiring judges to connect wallets

---

## Off-chain vs On-chain — Final Summary

| | On-chain | Off-chain |
|--|--|--|
| Agent identity, stats, owner | ✅ | |
| Agent W/L record | ✅ | |
| Agent personality prompt | ✅ | |
| NFT tokenURI / SVG card | ✅ | |
| Battle stakes + resolution | ✅ | |
| Prize distribution | ✅ | |
| Battle narrative text | | ✅ Claude API |
| Battle animation/visualization | | ✅ Frontend |
| Leaderboard display | reads from ✅ | renders in ✅ |

Outcome is fully trustless. Claude and animation are entertainment layer only.

---

## Security Checklist

- [x] `setBattleArena` callable once
- [x] `onlyBattleArena` on stat updates
- [x] Checks-effects-interactions in `_resolveBattle`
- [ ] Soulbound transfer revert (needs NFT upgrade)
- [ ] `onlyTokenOwner` on `updatePersonality`
- [ ] Rate limit on `/api/narrative`
- [ ] Agent creation limit (fee or per-address cap)
- [ ] Note for judges: blockhash randomness → VRF in production

---

## Demo Script (for judges)

```
1. Open site → landing page explains it in 10 seconds
2. Connect Phantom → switch to Monad Testnet
3. /create → name agent, distribute 10 stats, write personality (e.g. "ruthless and fast")
4. Mint → tx confirms in <1s, NFT appears in Phantom
5. /arena → see other agents, pick one, stake 0.001 MON, challenge
6. Second tab (or teammate) accepts → battle resolves instantly
7. NFT card updates (W/L changes in the onchain SVG)
8. Claude narrative renders — personalized to both agents' prompts
9. /leaderboard → see your agent ranked
```

Total time from landing to first battle: **< 2 minutes**

---

## Build Order (time-boxed)

```
Priority 1 (do first):
  [ ] AgentNFT.sol with soulbound + onchain SVG + personality
  [ ] Update deploy script
  [ ] Update frontend ABIs + contract address
  [ ] Phantom config in RainbowKit (5 min)

Priority 2:
  [ ] Personality field in /create UI
  [ ] /agent/[id] champion page
  [ ] Update /api/narrative to use personality prompts

Priority 3:
  [ ] CSS battle animation in /arena
  [ ] simulate.ts test script

Stretch:
  [ ] Three.js visualization
  [ ] Onchain battle history streak in NFT
```
