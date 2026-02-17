import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "@/lib/chains";
import {
  AGENT_REGISTRY_ADDRESS,
  AGENT_REGISTRY_ABI,
  BATTLE_ARENA_ADDRESS,
  BATTLE_ARENA_ABI,
} from "@/lib/contracts";

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export async function POST(req: NextRequest) {
  try {
    const { battleId } = await req.json();
    if (!battleId) {
      return NextResponse.json({ error: "battleId required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        narrative:
          "Two warriors clashed in the digital arena. Their stats collided in milliseconds on Monad's blazing chain. One fighter emerged victorious, claiming the prize and immortalizing their legend onchain.",
      });
    }

    // Fetch battle from chain
    const battle = (await publicClient.readContract({
      address: BATTLE_ARENA_ADDRESS,
      abi: BATTLE_ARENA_ABI,
      functionName: "getBattle",
      args: [BigInt(battleId)],
    })) as {
      id: bigint;
      challengerAgentId: bigint;
      challengedAgentId: bigint;
      stake: bigint;
      status: number;
      winnerAgentId: bigint;
    };

    const [agentA, agentB] = (await Promise.all([
      publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "getAgent",
        args: [battle.challengerAgentId],
      }),
      publicClient.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "getAgent",
        args: [battle.challengedAgentId],
      }),
    ])) as [
      {
        name: string;
        strength: number;
        speed: number;
        intelligence: number;
        wins: bigint;
        losses: bigint;
      },
      {
        name: string;
        strength: number;
        speed: number;
        intelligence: number;
        wins: bigint;
        losses: bigint;
      }
    ];

    const winnerIsA = battle.winnerAgentId === battle.challengerAgentId;
    const winner = winnerIsA ? agentA : agentB;
    const loser = winnerIsA ? agentB : agentA;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Write a dramatic 3-sentence battle narrative for this onchain arena fight. Be epic and punchy.

WINNER: ${winner.name} (STR:${winner.strength} SPD:${winner.speed} INT:${winner.intelligence}, record: ${winner.wins}W-${winner.losses}L)
LOSER: ${loser.name} (STR:${loser.strength} SPD:${loser.speed} INT:${loser.intelligence}, record: ${loser.wins}W-${loser.losses}L)

Rules: Only the narrative (no preamble), mention both names, end with ${winner.name} claiming victory and the prize MON. Keep it under 100 words.`,
        },
      ],
    });

    const narrative =
      msg.content[0].type === "text"
        ? msg.content[0].text
        : "An epic battle was fought and decided onchain.";

    return NextResponse.json({
      narrative,
      winner: winner.name,
      loser: loser.name,
    });
  } catch (error) {
    console.error("Narrative error:", error);
    return NextResponse.json({
      narrative:
        "Two warriors clashed in the digital arena. Their stats collided in milliseconds on Monad's blazing chain. One fighter emerged victorious, claiming the prize and immortalizing their legend onchain.",
    });
  }
}
