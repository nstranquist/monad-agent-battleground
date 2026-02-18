"use client";

import { use, useState, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useContracts } from "@/hooks/useContracts";
import { Agent, Battle } from "@/lib/types";
import Link from "next/link";
import { formatEther } from "viem";

function getClass(str: number, spd: number, intel: number): string {
  if (str >= 6) return "BERSERKER";
  if (spd >= 6) return "SPEEDSTER";
  if (intel >= 6) return "ORACLE";
  if (str === spd && spd === intel) return "BALANCED";
  if (str >= spd && str >= intel) return "WARRIOR";
  if (spd >= str && spd >= intel) return "PHANTOM";
  return "SAGE";
}

function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agentId = BigInt(id);
  const { address } = useAccount();
  const {
    agentNftAddress,
    agentNftAbi,
    battleArenaAddress,
    battleArenaAbi,
    battleStake,
    explorerUrl,
    networkLabel,
  } = useContracts();
  const [editingPersonality, setEditingPersonality] = useState(false);
  const [newPersonality, setNewPersonality] = useState("");
  const [updateTxHash, setUpdateTxHash] = useState<`0x${string}` | null>(null);

  const { data: agent, refetch } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: [agentId],
  }) as { data: Agent | undefined; refetch: () => void };

  const { data: tokenURI } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "tokenURI",
    args: [agentId],
  }) as { data: string | undefined };

  // ── Battle history ────────────────────────────────────────────────────────────

  const { data: allBattleIds } = useReadContract({
    address: battleArenaAddress,
    abi: battleArenaAbi,
    functionName: "getAllBattleIds",
  }) as { data: bigint[] | undefined };

  const { data: battlesRaw, isLoading: battlesLoading } = useReadContracts({
    contracts: (allBattleIds ?? []).map((bid) => ({
      address: battleArenaAddress,
      abi: battleArenaAbi,
      functionName: "getBattle" as const,
      args: [bid] as [bigint],
    })),
    query: { enabled: !!allBattleIds && allBattleIds.length > 0 },
  });

  // Filter to completed battles involving this agent, newest first
  const agentBattles = useMemo<Battle[]>(() => {
    if (!battlesRaw) return [];
    return battlesRaw
      .map((r) => r.result as Battle | undefined)
      .filter((b): b is Battle => {
        if (!b) return false;
        return (
          b.status === 1 &&
          (b.challengerAgentId === agentId || b.challengedAgentId === agentId)
        );
      })
      .sort((a, b) => Number(b.resolvedAt) - Number(a.resolvedAt));
  }, [battlesRaw, agentId]);

  // Unique opponent IDs so we can batch-load their names
  const opponentIds = useMemo<bigint[]>(() => {
    const seen = new Map<string, bigint>();
    for (const b of agentBattles) {
      const opId = b.challengerAgentId === agentId ? b.challengedAgentId : b.challengerAgentId;
      seen.set(opId.toString(), opId);
    }
    return Array.from(seen.values());
  }, [agentBattles, agentId]);

  const { data: opponentsRaw } = useReadContracts({
    contracts: opponentIds.map((opId) => ({
      address: agentNftAddress,
      abi: agentNftAbi,
      functionName: "getAgent" as const,
      args: [opId] as [bigint],
    })),
    query: { enabled: opponentIds.length > 0 },
  });

  const opponentMap = useMemo<Map<string, Agent>>(() => {
    const map = new Map<string, Agent>();
    if (!opponentsRaw) return map;
    opponentIds.forEach((opId, i) => {
      const ag = opponentsRaw[i]?.result as Agent | undefined;
      if (ag) map.set(opId.toString(), ag);
    });
    return map;
  }, [opponentsRaw, opponentIds]);

  // ── Personality update ────────────────────────────────────────────────────────

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: updateTxHash ?? undefined,
  });

  if (isSuccess && editingPersonality) {
    setEditingPersonality(false);
    setUpdateTxHash(null);
    refetch();
  }

  const handleUpdatePersonality = async () => {
    if (!newPersonality.trim()) return;
    try {
      const hash = await writeContractAsync({
        address: agentNftAddress,
        abi: agentNftAbi,
        functionName: "updatePersonality",
        args: [agentId, newPersonality.trim()],
      });
      setUpdateTxHash(hash);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Decode onchain SVG ────────────────────────────────────────────────────────

  let svgDataUrl: string | null = null;
  if (tokenURI && tokenURI.startsWith("data:application/json;base64,")) {
    try {
      const json = JSON.parse(atob(tokenURI.split(",")[1]));
      svgDataUrl = json.image;
    } catch {}
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monad-border rounded w-1/2 mx-auto" />
          <div className="h-96 bg-monad-card border border-monad-border rounded-lg" />
        </div>
      </div>
    );
  }

  const isOwner = address?.toLowerCase() === agent.owner.toLowerCase();
  const winRate =
    Number(agent.wins) + Number(agent.losses) > 0
      ? Math.round((Number(agent.wins) / (Number(agent.wins) + Number(agent.losses))) * 100)
      : null;
  const agentClass = getClass(agent.strength, agent.speed, agent.intelligence);

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/arena" className="text-sm text-gray-500 hover:text-monad-purple transition-colors">
          ← Back to Arena
        </Link>
        <span className="text-xs text-gray-600">
          Token #{id} · {networkLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NFT Card (onchain SVG) */}
        <div>
          <div className="text-xs text-gray-600 mb-2 text-center">
            Live onchain SVG — updates with every battle
          </div>
          {svgDataUrl ? (
            <img
              src={svgDataUrl}
              alt={agent.name}
              className="w-full rounded-xl border border-monad-border glow-purple"
            />
          ) : (
            <div className="aspect-[3/4] bg-monad-card border border-monad-border rounded-xl flex items-center justify-center text-gray-600">
              Loading NFT...
            </div>
          )}
        </div>

        {/* Stats + Info */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              {isOwner && (
                <span className="text-xs px-2 py-0.5 bg-monad-purple/20 text-monad-purple border border-monad-purple/30 rounded">
                  YOURS
                </span>
              )}
            </div>
            <div className="text-monad-purple text-sm font-bold">{agentClass}</div>
          </div>

          {/* Record */}
          <div className="bg-monad-card border border-monad-border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-2">BATTLE RECORD</div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-green-400">{agent.wins.toString()}W</span>
              <span className="text-gray-600">-</span>
              <span className="text-3xl font-bold text-red-400">{agent.losses.toString()}L</span>
              {winRate !== null && (
                <span className="text-sm text-monad-purple ml-2">{winRate}% win rate</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-monad-card border border-monad-border rounded-lg p-4 space-y-3">
            <div className="text-xs text-gray-500 mb-1">STATS</div>
            <StatRow label="STR" value={agent.strength} color="bg-red-500" />
            <StatRow label="SPD" value={agent.speed} color="bg-yellow-400" />
            <StatRow label="INT" value={agent.intelligence} color="bg-blue-400" />
          </div>

          {/* Personality */}
          <div className="bg-monad-card border border-monad-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">PERSONALITY</div>
              {isOwner && !editingPersonality && (
                <button
                  onClick={() => {
                    setNewPersonality(agent.personalityPrompt || "");
                    setEditingPersonality(true);
                  }}
                  className="text-xs text-monad-purple hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingPersonality ? (
              <div className="space-y-2">
                <textarea
                  value={newPersonality}
                  onChange={(e) => setNewPersonality(e.target.value.slice(0, 200))}
                  rows={3}
                  maxLength={200}
                  className="w-full bg-monad-dark border border-monad-border focus:border-monad-purple rounded px-3 py-2 text-sm text-white outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdatePersonality}
                    disabled={isPending || isConfirming}
                    className="flex-1 py-1.5 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 text-white text-xs font-bold rounded"
                  >
                    {isPending ? "Confirm..." : isConfirming ? "Saving..." : "Save Onchain"}
                  </button>
                  <button
                    onClick={() => setEditingPersonality(false)}
                    className="px-3 py-1.5 border border-monad-border text-gray-400 text-xs rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-monad-purple/80 italic">
                {agent.personalityPrompt ? (
                  `"${agent.personalityPrompt}"`
                ) : (
                  <span className="text-gray-600 not-italic">No personality set yet.</span>
                )}
              </p>
            )}
          </div>

          {/* Owner */}
          <div className="text-xs text-gray-600">
            Owner:{" "}
            <a
              href={`${explorerUrl}/address/${agent.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-monad-purple hover:underline"
            >
              {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
            </a>
            <span className="ml-2 text-gray-700">· Soulbound (non-transferable)</span>
          </div>

          {/* CTA */}
          <Link
            href="/arena"
            className="block w-full py-3 bg-monad-purple hover:bg-monad-purple/80 text-white font-bold rounded-lg text-center transition-colors"
          >
            ⚔ Fight (stake {formatEther(battleStake)} MON)
          </Link>
        </div>
      </div>

      {/* Battle History */}
      <BattleHistory
        agentId={agentId}
        battles={agentBattles}
        opponentMap={opponentMap}
        explorerUrl={explorerUrl}
        isLoading={battlesLoading || (!!allBattleIds && allBattleIds.length > 0 && !battlesRaw)}
      />
    </div>
  );
}

// ── Battle History section ─────────────────────────────────────────────────────

function BattleHistory({
  agentId,
  battles,
  opponentMap,
  explorerUrl,
  isLoading,
}: {
  agentId: bigint;
  battles: Battle[];
  opponentMap: Map<string, Agent>;
  explorerUrl: string;
  isLoading: boolean;
}) {
  return (
    <div className="bg-monad-card border border-monad-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-gray-500 font-bold tracking-widest">BATTLE HISTORY</div>
        {battles.length > 0 && (
          <div className="text-xs text-gray-600">{battles.length} completed</div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-14 bg-monad-dark rounded-lg" />
          ))}
        </div>
      ) : battles.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">
          No battles fought yet.{" "}
          <Link href="/arena" className="text-monad-purple hover:underline">
            Challenge someone!
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {battles.map((battle) => {
            const isChallenger = battle.challengerAgentId === agentId;
            const opponentId = isChallenger ? battle.challengedAgentId : battle.challengerAgentId;
            const opponent = opponentMap.get(opponentId.toString());
            const won = battle.winnerAgentId === agentId;
            return (
              <BattleRow
                key={battle.id.toString()}
                battle={battle}
                won={won}
                isChallenger={isChallenger}
                opponent={opponent}
                opponentId={opponentId}
                explorerUrl={explorerUrl}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BattleRow({
  battle,
  won,
  isChallenger,
  opponent,
  opponentId,
  explorerUrl,
}: {
  battle: Battle;
  won: boolean;
  isChallenger: boolean;
  opponent: Agent | undefined;
  opponentId: bigint;
  explorerUrl: string;
}) {
  const opponentClass = opponent
    ? getClass(opponent.strength, opponent.speed, opponent.intelligence)
    : null;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        won ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
      }`}
    >
      {/* Win/Loss badge */}
      <div
        className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 w-10 text-center ${
          won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        }`}
      >
        {won ? "WIN" : "LOSS"}
      </div>

      {/* Opponent info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium">vs</span>
          <Link
            href={`/agent/${opponentId.toString()}`}
            className="text-sm text-white hover:text-monad-purple transition-colors truncate"
          >
            {opponent?.name ?? `Agent #${opponentId.toString()}`}
          </Link>
          {opponentClass && (
            <span className="text-xs text-monad-purple/50 hidden sm:block flex-shrink-0">
              {opponentClass}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {isChallenger ? "Challenged" : "Defended"} · {formatDate(battle.resolvedAt)}
        </div>
      </div>

      {/* Stake + Battle ID */}
      <div className="text-right flex-shrink-0 space-y-0.5">
        <div className={`text-xs font-medium ${won ? "text-green-400" : "text-red-400"}`}>
          {won ? "+" : "-"}
          {formatEther(battle.stake)} MON
        </div>
        <div className="text-xs text-gray-700">
          Battle{" "}
          <a
            href={`${explorerUrl}/address/${battle.challenger}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-monad-purple transition-colors"
            title="View on explorer"
          >
            #{battle.id.toString()}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Shared stat bar ────────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-7">{label}</span>
      <div className="flex-1 stat-bar">
        <div className={`stat-bar-fill ${color}`} style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-sm text-white w-3 text-right">{value}</span>
    </div>
  );
}
