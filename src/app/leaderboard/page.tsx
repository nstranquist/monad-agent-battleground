"use client";

import { useState, useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useContracts } from "@/hooks/useContracts";
import { Agent } from "@/lib/types";
import Link from "next/link";

const PAGE_SIZE = 50;

const QUERY_CONFIG = {
  staleTime: 60_000,       // treat data as fresh for 60s
  refetchInterval: false,  // no polling
  gcTime: 5 * 60_000,     // keep in cache 5 min
} as const;

export default function LeaderboardPage() {
  const { agentNftAddress, agentNftAbi, explorerUrl, networkLabel, chainId } = useContracts();
  const [page, setPage] = useState(0);

  // ── 1. Fetch all IDs (one cheap call) ─────────────────────────────────────
  const { data: allAgentIds, isLoading: idsLoading } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAllAgentIds",
    query: QUERY_CONFIG,
  }) as { data: bigint[] | undefined; isLoading: boolean };

  const totalAgents = allAgentIds?.length ?? 0;
  const totalPages = Math.ceil(totalAgents / PAGE_SIZE);

  // ── 2. Slice IDs for current page ─────────────────────────────────────────
  const pageIds = useMemo(() => {
    if (!allAgentIds) return [];
    const start = page * PAGE_SIZE;
    return allAgentIds.slice(start, start + PAGE_SIZE);
  }, [allAgentIds, page]);

  // ── 3. Multicall: fetch all agents on this page in ONE request ─────────────
  const contracts = useMemo(
    () =>
      pageIds.map((id) => ({
        address: agentNftAddress,
        abi: agentNftAbi,
        functionName: "getAgent" as const,
        args: [id] as [bigint],
      })),
    [pageIds, agentNftAddress, agentNftAbi]
  );

  const { data: agentResults, isLoading: agentsLoading } = useReadContracts({
    contracts,
    query: {
      ...QUERY_CONFIG,
      enabled: contracts.length > 0,
    },
  });

  // ── 4. Parse + sort by wins desc ──────────────────────────────────────────
  const agents = useMemo<Agent[]>(() => {
    if (!agentResults) return [];
    return agentResults
      .map((r) => r.result as Agent | undefined)
      .filter((a): a is Agent => !!a)
      .sort((a, b) => Number(b.wins) - Number(a.wins));
  }, [agentResults]);

  const isLoading = idsLoading || agentsLoading;
  const globalOffset = page * PAGE_SIZE;

  const medals: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-gray-400">
            All agents ranked by wins · Live from{" "}
            <span className="text-monad-purple">{networkLabel}</span>
            {totalAgents > 0 && (
              <span className="text-gray-600"> · {totalAgents} agents total</span>
            )}
          </p>
        </div>
      </div>

      {/* Table */}
      {!agentNftAddress ? (
        <div className="text-center py-16 text-gray-400 border border-monad-border rounded-lg">
          Contracts not deployed on {networkLabel} yet.
        </div>
      ) : idsLoading ? (
        <div className="text-center py-16 text-gray-500 border border-monad-border rounded-lg animate-pulse">
          Loading agents…
        </div>
      ) : totalAgents === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-monad-border rounded-lg">
          No agents yet.{" "}
          <Link href="/create" className="text-monad-purple underline">
            Be the first →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-monad-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-monad-border bg-monad-card">
                <th className="px-4 py-3 text-gray-500 font-medium text-center w-16">Rank</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-left">Agent</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">Class</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">STR/SPD/INT</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">Wins</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">Losses</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">Win Rate</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-center">Owner</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: Math.min(PAGE_SIZE, 10) }).map((_, i) => (
                    <tr key={i} className="border-b border-monad-border">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="h-4 bg-monad-border rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : agents.map((agent, i) => {
                    const rank = globalOffset + i;
                    const total = Number(agent.wins) + Number(agent.losses);
                    const winRate = total > 0 ? Math.round((Number(agent.wins) / total) * 100) : 0;
                    const agentClass = getClass(agent.strength, agent.speed, agent.intelligence);

                    return (
                      <tr
                        key={agent.id.toString()}
                        className="border-b border-monad-border hover:bg-monad-purple/5 transition-colors"
                      >
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-monad-purple">
                            {medals[rank] ?? `#${rank + 1}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          <Link
                            href={`/agent/${agent.id.toString()}`}
                            className="hover:text-monad-purple transition-colors"
                          >
                            {agent.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-mono text-monad-purple/80 border border-monad-purple/30 rounded px-1.5 py-0.5">
                            {agentClass}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-sm">
                          <span className="text-red-400">{agent.strength}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-yellow-400">{agent.speed}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-blue-400">{agent.intelligence}</span>
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
                          <a
                            href={`${explorerUrl}/address/${agent.owner}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 font-mono hover:text-monad-purple"
                          >
                            {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page + 1} of {totalPages} · showing{" "}
            {globalOffset + 1}–{Math.min(globalOffset + PAGE_SIZE, totalAgents)} of {totalAgents}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-monad-border text-gray-400 hover:border-monad-purple hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {/* Page number pills — show at most 5 around current */}
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => Math.abs(i - page) <= 2)
              .map((i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    i === page
                      ? "border-monad-purple bg-monad-purple/20 text-white"
                      : "border-monad-border text-gray-400 hover:border-monad-purple hover:text-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded border border-monad-border text-gray-400 hover:border-monad-purple hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-600">
        Stats stored permanently onchain · {networkLabel} · Chain ID: {chainId} ·{" "}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-monad-purple hover:underline"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}

// Mirror of the contract's _getClass logic
function getClass(str: number, spd: number, intel: number): string {
  if (str >= 6) return "BERSERKER";
  if (spd >= 6) return "SPEEDSTER";
  if (intel >= 6) return "ORACLE";
  if (str === spd && spd === intel) return "BALANCED";
  if (str >= spd && str >= intel) return "WARRIOR";
  if (spd >= str && spd >= intel) return "PHANTOM";
  return "SAGE";
}
