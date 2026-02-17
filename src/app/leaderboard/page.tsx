"use client";

import { useReadContract } from "wagmi";
import {
  AGENT_REGISTRY_ADDRESS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";
import { Agent } from "@/lib/types";

function AgentLeaderboardRow({
  agentId,
  rank,
}: {
  agentId: bigint;
  rank: number;
}) {
  const { data: agent } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [agentId],
  }) as { data: Agent | undefined };

  if (!agent) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3">
          <div className="h-4 bg-monad-border rounded animate-pulse" />
        </td>
      </tr>
    );
  }

  const total = Number(agent.wins) + Number(agent.losses);
  const winRate = total > 0 ? Math.round((Number(agent.wins) / total) * 100) : 0;

  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <tr className="border-b border-monad-border hover:bg-monad-purple/5 transition-colors">
      <td className="px-4 py-3 text-center">
        <span className="font-bold text-monad-purple">
          {medals[rank] || `#${rank}`}
        </span>
      </td>
      <td className="px-4 py-3 font-bold text-white">{agent.name}</td>
      <td className="px-4 py-3 text-center">
        <span className="text-red-400 font-mono text-sm">{agent.strength}</span>
        <span className="text-gray-600">/</span>
        <span className="text-yellow-400 font-mono text-sm">{agent.speed}</span>
        <span className="text-gray-600">/</span>
        <span className="text-blue-400 font-mono text-sm">{agent.intelligence}</span>
      </td>
      <td className="px-4 py-3 text-center text-green-400 font-bold">
        {agent.wins.toString()}
      </td>
      <td className="px-4 py-3 text-center text-red-400">
        {agent.losses.toString()}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`font-bold ${
            winRate >= 60
              ? "text-green-400"
              : winRate >= 40
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {total === 0 ? "—" : `${winRate}%`}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs text-gray-500 font-mono">
          {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
        </span>
      </td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const { data: allAgentIds } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAllAgentIds",
  }) as { data: bigint[] | undefined };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400">
          All registered agents ranked by wins. Updated live from Monad.
        </p>
      </div>

      {!allAgentIds || allAgentIds.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-monad-border rounded-lg">
          No agents registered yet.{" "}
          <a href="/create" className="text-monad-purple underline">
            Be the first →
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-monad-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-monad-border bg-monad-card">
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  Rank
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-left">
                  Agent
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  STR/SPD/INT
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  Wins
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  Losses
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  Win Rate
                </th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">
                  Owner
                </th>
              </tr>
            </thead>
            <tbody>
              {allAgentIds.map((id, i) => (
                <AgentLeaderboardRow key={id.toString()} agentId={id} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center text-xs text-gray-600">
        Stats are stored permanently onchain on Monad Testnet.
        <br />
        Chain ID: 10143 · Explorer:{" "}
        <a
          href="https://testnet.monadexplorer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-monad-purple hover:underline"
        >
          testnet.monadexplorer.com
        </a>
      </div>
    </div>
  );
}
