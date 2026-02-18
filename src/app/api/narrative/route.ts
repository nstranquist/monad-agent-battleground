import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "@/lib/chains";
import {
  AGENT_NFT_ADDRESS,
  AGENT_NFT_ABI,
  BATTLE_ARENA_ADDRESS,
  BATTLE_ARENA_ABI,
} from "@/lib/contracts";

// In-memory rate limiter: 100 requests per IP per minute (generous for demo)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const FALLBACK =
  "Two champions clashed in the digital arena, their stats colliding in milliseconds on Monad's blazing chain. The battle was fierce, decided in a single atomic transaction. One fighter emerged victorious, claiming the prize MON and ascending the leaderboard for eternity.";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  try {
    const { battleId } = await req.json();
    if (!battleId) return NextResponse.json({ error: "battleId required" }, { status: 400 });
    if (!AGENT_NFT_ADDRESS || !BATTLE_ARENA_ADDRESS) return NextResponse.json({ narrative: FALLBACK });

    const battle = (await publicClient.readContract({
      address: BATTLE_ARENA_ADDRESS,
      abi: BATTLE_ARENA_ABI,
      functionName: "getBattle",
      args: [BigInt(battleId)],
    })) as { challengerAgentId: bigint; challengedAgentId: bigint; status: number; winnerAgentId: bigint };

    if (battle.status !== 1) return NextResponse.json({ narrative: FALLBACK });

    const [agentA, agentB] = (await Promise.all([
      publicClient.readContract({ address: AGENT_NFT_ADDRESS, abi: AGENT_NFT_ABI, functionName: "getAgent", args: [battle.challengerAgentId] }),
      publicClient.readContract({ address: AGENT_NFT_ADDRESS, abi: AGENT_NFT_ABI, functionName: "getAgent", args: [battle.challengedAgentId] }),
    ])) as [
      { name: string; strength: number; speed: number; intelligence: number; personalityPrompt?: string; wins: bigint; losses: bigint },
      { name: string; strength: number; speed: number; intelligence: number; personalityPrompt?: string; wins: bigint; losses: bigint }
    ];

    const winnerIsA = battle.winnerAgentId === battle.challengerAgentId;
    const winner = winnerIsA ? agentA : agentB;
    const loser  = winnerIsA ? agentB : agentA;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ narrative: FALLBACK, winner: winner.name, loser: loser.name });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [{
        role: "user",
        content: `Write a dramatic 3-sentence battle narrative for this onchain arena fight.

WINNER: ${winner.name} (STR ${winner.strength}/SPD ${winner.speed}/INT ${winner.intelligence}, ${winner.wins}W-${winner.losses}L)
Personality: "${winner.personalityPrompt || "fierce and determined"}"

LOSER: ${loser.name} (STR ${loser.strength}/SPD ${loser.speed}/INT ${loser.intelligence}, ${loser.wins}W-${loser.losses}L)
Personality: "${loser.personalityPrompt || "a worthy opponent"}"

Output only the narrative. Mention both names. Let their personalities shape the writing style. End with ${winner.name} claiming victory and the MON prize. Under 80 words.`,
      }],
    });

    const narrative = msg.content[0].type === "text" ? msg.content[0].text : FALLBACK;
    return NextResponse.json({ narrative, winner: winner.name, loser: loser.name });
  } catch (error) {
    console.error("Narrative error:", error);
    return NextResponse.json({ narrative: FALLBACK });
  }
}
