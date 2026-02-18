"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { useContracts } from "@/hooks/useContracts";
import { AgentCard } from "@/components/AgentCard";
import { Agent, Battle } from "@/lib/types";
import type { BattlePhase } from "@/components/BattleArena3D";

// Three.js is browser-only — must be dynamically imported with ssr: false
const BattleArena3D = dynamic(
  () => import("@/components/BattleArena3D").then((m) => ({ default: m.BattleArena3D })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#04040f]">
        <div className="text-gray-600 text-sm animate-pulse">Loading arena...</div>
      </div>
    ),
  }
);

// ── Training mode ─────────────────────────────────────────────────────────────

const TRAINER_BOT: Agent = {
  id: 0n,
  name: "TRAINER BOT",
  owner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  strength: 3,
  speed: 3,
  intelligence: 4,
  personalityPrompt: "A battle simulation bot. No mercy in training.",
  wins: 999n,
  losses: 0n,
  createdAt: 0n,
  exists: true,
};

// Agents owned by these addresses are hidden from the opponent picker
// (simulation / deployer test wallets that pollute the UI for real users)
const TEST_ADDRESSES = new Set([
  "0x87c1a9281abcb1b894792b49b4ff7b95de667201",
]);

function resolveTrainingBattle(player: Agent): boolean {
  const seed = Date.now();
  const s1 = (seed % 10) + 1;
  const s2 = ((seed >>> 5) % 10) + 1;
  const s3 = ((seed >>> 10) % 10) + 1;
  const ps = player.strength * s1 + player.speed * s2 + player.intelligence * s3;
  const ts = TRAINER_BOT.strength * s1 + TRAINER_BOT.speed * s2 + TRAINER_BOT.intelligence * s3;
  return ps >= ts;
}

const TRAIN_WIN = [
  "{p} faced TRAINER BOT in the sim ring and won decisively. No MON at stake, no record on-chain — but the form was immaculate. The real arena should fear what's coming.",
  "TRAINER BOT pushed {p} through brutal exchanges, but the challenger's stats won out. Clean training victory. Time to take that energy to a real battle.",
  "{p} read every move TRAINER BOT had and countered perfectly. Off-chain, off-record — but completely on point. The Monad arena awaits.",
];
const TRAIN_LOSS = [
  "TRAINER BOT out-pointed {p} in the simulation. No MON lost, no record dinged — just a signal to sharpen the strategy before the real arena.",
  "{p} fought hard but TRAINER BOT exploited the stat gaps. Training round complete. Lesson noted.",
  "The drill ended with {p} on the back foot. Adjust the personality, rethink the build, then challenge someone for real MON.",
];
function makeTrainingNarrative(name: string, won: boolean): string {
  const pool = won ? TRAIN_WIN : TRAIN_LOSS;
  return pool[Math.floor(Math.random() * pool.length)].replace(/\{p\}/g, name);
}

// ── Step type ─────────────────────────────────────────────────────────────────

type Step = "select-my-agent" | "select-opponent" | "battling" | "battle-result" | "training" | "training-result";

export default function ArenaPage() {
  const { address, isConnected } = useAccount();
  const { agentNftAddress, agentNftAbi, battleArenaAddress, battleArenaAbi, battleStake } = useContracts();
  const [step, setStep] = useState<Step>("select-my-agent");
  const [myAgentId, setMyAgentId] = useState<bigint | null>(null);
  const [opponentAgentId, setOpponentAgentId] = useState<bigint | null>(null);
  const [battleId, setBattleId] = useState<bigint | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [pendingBattleId, setPendingBattleId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [resolvedBattleId, setResolvedBattleId] = useState<bigint | null>(null);
  const [clashPhase, setClashPhase] = useState<BattlePhase>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Load all agent IDs
  const { data: allAgentIds } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAllAgentIds",
  });

  // Load my agent IDs
  const { data: myAgentIds } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getOwnerAgents",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Load all battles
  const { data: allBattleIds } = useReadContract({
    address: battleArenaAddress,
    abi: battleArenaAbi,
    functionName: "getAllBattleIds",
  });

  // Fetch narrative after battle confirmed
  const fetchNarrative = useCallback(async (bid: bigint) => {
    setNarrativeLoading(true);
    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: bid.toString() }),
      });
      const data = await res.json();
      setNarrative(data.narrative);
    } catch {
      setNarrative("The battle was too intense to put into words...");
    } finally {
      setNarrativeLoading(false);
    }
  }, []);

  // When battle tx confirms, run clash animation then fetch narrative
  useEffect(() => {
    if (!isSuccess || !txHash) return;
    const bid = pendingBattleId ?? battleId;
    if (!bid) return;

    setResolvedBattleId(bid);
    setStep("battling");
    setClashPhase("charging");

    // 3D clash animation sequence — extended to let the scene breathe
    // charging: fighters rush toward center (0–1200ms)
    // clash:    explosion + camera shake (1200–3200ms)
    // done:     transition to result screen, narrative fetches in parallel
    const t1 = setTimeout(() => setClashPhase("clash"), 1200);
    const t2 = setTimeout(() => {
      setClashPhase("done");
      setStep("battle-result");
      fetchNarrative(bid);
    }, 3200);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isSuccess]);

  const handleChallenge = async () => {
    if (!myAgentId || !opponentAgentId) return;
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: battleArenaAddress,
        abi: battleArenaAbi,
        functionName: "challenge",
        args: [myAgentId, opponentAgentId],
        value: battleStake,
      });
      setTxHash(hash);
      setBattleId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setTxError("Transaction cancelled.");
      } else {
        setTxError("Transaction failed. Check your wallet balance and try again.");
      }
      console.error(e);
    }
  };

  const handleAcceptChallenge = async (bid: bigint) => {
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: battleArenaAddress,
        abi: battleArenaAbi,
        functionName: "acceptChallenge",
        args: [bid],
        value: battleStake,
      });
      setTxHash(hash);
      setPendingBattleId(bid);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setTxError("Transaction cancelled.");
      } else {
        setTxError("Transaction failed. Check your wallet balance and try again.");
      }
      console.error(e);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-4xl">⚔</div>
        <h2 className="text-2xl font-bold">Enter the Arena</h2>
        <p className="text-gray-400 mb-6">Connect your wallet to battle.</p>
        <ConnectButton />
      </div>
    );
  }

  // Clash animation screen
  if (step === "battling") {
    return (
      <ClashScreen
        myAgentId={myAgentId ?? opponentAgentId}
        opponentAgentId={opponentAgentId ?? myAgentId}
        phase={clashPhase}
      />
    );
  }

  // Battle result screen
  if (step === "battle-result" && resolvedBattleId !== null) {
    return (
      <BattleResultScreen
        battleId={resolvedBattleId}
        narrative={narrative}
        narrativeLoading={narrativeLoading}
        onReset={() => {
          setStep("select-my-agent");
          setMyAgentId(null);
          setOpponentAgentId(null);
          setBattleId(null);
          setNarrative(null);
          setTxHash(null);
          setPendingBattleId(null);
          setResolvedBattleId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Battle Arena</h1>
        <p className="text-gray-400">
          Select your agent, challenge an opponent, and stake{" "}
          <span className="text-monad-purple font-bold">
            {formatEther(battleStake)} MON
          </span>{" "}
          per side.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["select-my-agent", "select-opponent"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? "bg-monad-purple text-white"
                  : i === 0 && step === "select-opponent"
                  ? "bg-green-500 text-white"
                  : "bg-monad-border text-gray-400"
              }`}
            >
              {i + 1}
            </div>
            <span className={step === s ? "text-white" : "text-gray-500"}>
              {s === "select-my-agent" ? "Your Agent" : "Opponent"}
            </span>
            {i < 1 && <span className="text-gray-600">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Select my agent */}
      {step === "select-my-agent" && (
        <AgentSelector
          title="Select Your Fighter"
          agentIds={myAgentIds as bigint[] | undefined}
          selectedId={myAgentId}
          onSelect={setMyAgentId}
          emptyMessage={
            <span>
              You have no agents.{" "}
              <a href="/create" className="text-monad-purple underline">
                Create one →
              </a>
            </span>
          }
        >
          <button
            disabled={!myAgentId}
            onClick={() => setStep("select-opponent")}
            className="w-full py-3 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg"
          >
            Next: Choose Opponent →
          </button>
        </AgentSelector>
      )}

      {/* Step 2: Select opponent + fight */}
      {step === "select-opponent" && (
        <AgentSelector
          title="Choose Your Opponent"
          agentIds={(allAgentIds as bigint[] | undefined)?.filter(
            (id) => id !== myAgentId
          )}
          selectedId={opponentAgentId}
          onSelect={setOpponentAgentId}
          emptyMessage="No other agents yet. Invite friends!"
        >
          <div className="flex gap-3">
            <button
              onClick={() => setStep("select-my-agent")}
              className="flex-1 py-3 border border-monad-border hover:border-monad-purple text-gray-300 font-bold rounded-lg"
            >
              ← Back
            </button>
            <button
              disabled={!opponentAgentId || isPending || isConfirming}
              onClick={handleChallenge}
              className="flex-1 py-3 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg"
            >
              {isPending
                ? "Confirm in wallet..."
                : isConfirming
                ? "⏳ On-chain battle..."
                : `⚔ FIGHT! (stake ${formatEther(battleStake)} MON)`}
            </button>
          </div>
        </AgentSelector>
      )}

      {txError && (
        <div className="text-sm text-red-400 text-center border border-red-500/30 rounded p-3">
          {txError}
        </div>
      )}

      {/* Pending Challenges */}
      <PendingChallenges
        address={address}
        myAgentIds={myAgentIds as bigint[] | undefined}
        allBattleIds={allBattleIds as bigint[] | undefined}
        onAccept={handleAcceptChallenge}
        isPending={isPending}
        isConfirming={isConfirming}
      />
    </div>
  );
}

// ── Clash animation screen (3D) ───────────────────────────────────────────────

const PHASE_LABEL: Record<BattlePhase, string> = {
  idle:     "Entering the Arena...",
  charging: "CHARGING FORWARD",
  clash:    "⚡ CLASH ⚡",
  done:     "Battle Resolved",
};

function ClashScreen({
  myAgentId,
  opponentAgentId,
  phase,
}: {
  myAgentId: bigint | null;
  opponentAgentId: bigint | null;
  phase: BattlePhase;
}) {
  const { agentNftAddress, agentNftAbi } = useContracts();
  const { data: myAgent } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: myAgentId ? [myAgentId] : undefined,
    query: { enabled: !!myAgentId },
  }) as { data: Agent | undefined };

  const { data: oppAgent } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: opponentAgentId ? [opponentAgentId] : undefined,
    query: { enabled: !!opponentAgentId },
  }) as { data: Agent | undefined };

  const isClash = phase === "clash";

  return (
    <div className="relative w-full" style={{ height: "72vh" }}>
      {/* 3D canvas */}
      <BattleArena3D
        myAgent={myAgent as Agent | undefined}
        oppAgent={oppAgent as Agent | undefined}
        phase={phase}
      />

      {/* Phase overlay — bottom center */}
      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1.5 pointer-events-none">
        <div
          className={`font-bold tracking-widest transition-all duration-300 ${
            isClash
              ? "text-2xl text-white scale-110"
              : "text-base text-monad-purple"
          }`}
          style={
            isClash
              ? { textShadow: "0 0 20px #fff, 0 0 40px #836ef9" }
              : undefined
          }
        >
          {PHASE_LABEL[phase]}
        </div>
        <div className="text-xs text-gray-600 animate-pulse tracking-widest">
          RESOLVING ON MONAD
        </div>
      </div>
    </div>
  );
}

// ── Battle result screen ──────────────────────────────────────────────────────

function BattleResultScreen({
  battleId,
  narrative,
  narrativeLoading,
  onReset,
}: {
  battleId: bigint;
  narrative: string | null;
  narrativeLoading: boolean;
  onReset: () => void;
}) {
  const { agentNftAddress, agentNftAbi, battleArenaAddress, battleArenaAbi, battleStake } = useContracts();
  const { data: battle } = useReadContract({
    address: battleArenaAddress,
    abi: battleArenaAbi,
    functionName: "getBattle",
    args: [battleId],
  }) as { data: Battle | undefined };

  const { data: winnerAgent } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: battle?.winnerAgentId ? [battle.winnerAgentId] : undefined,
    query: { enabled: !!battle?.winnerAgentId },
  }) as { data: Agent | undefined };

  const { data: challengerAgent } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: battle?.challengerAgentId ? [battle.challengerAgentId] : undefined,
    query: { enabled: !!battle },
  }) as { data: Agent | undefined };

  const { data: challengedAgent } = useReadContract({
    address: agentNftAddress,
    abi: agentNftAbi,
    functionName: "getAgent",
    args: battle?.challengedAgentId ? [battle.challengedAgentId] : undefined,
    query: { enabled: !!battle },
  }) as { data: Agent | undefined };

  const loserAgent =
    battle && winnerAgent
      ? battle.winnerAgentId === battle.challengerAgentId
        ? challengedAgent
        : challengerAgent
      : undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8 fade-in-up">
      {/* Winner banner */}
      {winnerAgent ? (
        <div className="text-center space-y-2">
          <div className="text-5xl">🏆</div>
          <h2 className="text-3xl font-bold text-monad-purple">
            {winnerAgent.name} wins!
          </h2>
          {loserAgent && (
            <p className="text-gray-400 text-sm">
              defeated <span className="text-white">{loserAgent.name}</span>
            </p>
          )}
          <p className="text-gray-500 text-xs">
            Payout: {formatEther(battleStake * 2n)} MON · Battle #{battleId.toString()}
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-3xl font-bold">Battle #{battleId.toString()} resolved</div>
        </div>
      )}

      {/* Fighter cards */}
      {challengerAgent && challengedAgent && (
        <div className="grid grid-cols-2 gap-4">
          <div className={winnerAgent?.id === challengerAgent.id ? "opacity-100" : "opacity-40"}>
            <AgentCard agent={challengerAgent as Agent} />
          </div>
          <div className={winnerAgent?.id === challengedAgent.id ? "opacity-100" : "opacity-40"}>
            <AgentCard agent={challengedAgent as Agent} />
          </div>
        </div>
      )}

      {/* Narrative */}
      <div className="bg-monad-card border border-monad-border rounded-lg p-5">
        <div className="text-sm font-bold text-monad-purple mb-3">Battle Narrative</div>
        {narrativeLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-monad-border rounded w-full" />
            <div className="h-3 bg-monad-border rounded w-5/6" />
            <div className="h-3 bg-monad-border rounded w-4/5" />
            <div className="h-3 bg-monad-border rounded w-full" />
          </div>
        ) : narrative ? (
          <p className="narrative-text text-sm text-reveal">{narrative}</p>
        ) : (
          <p className="text-gray-500 text-sm italic">Narrative unavailable.</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 bg-monad-purple hover:bg-monad-purple/80 text-white font-bold rounded-lg"
        >
          Fight Again →
        </button>
        <a
          href="/leaderboard"
          className="flex-1 py-3 border border-monad-border hover:border-monad-purple text-gray-300 font-bold rounded-lg text-center"
        >
          Leaderboard
        </a>
      </div>
    </div>
  );
}

// ── Agent selector ────────────────────────────────────────────────────────────

function AgentSelector({
  title,
  agentIds,
  selectedId,
  onSelect,
  emptyMessage,
  children,
}: {
  title: string;
  agentIds?: bigint[];
  selectedId: bigint | null;
  onSelect: (id: bigint) => void;
  emptyMessage: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { agentNftAddress, agentNftAbi } = useContracts();

  // Batch-load all agents in a single multicall instead of N individual calls
  const { data: agentResults } = useReadContracts({
    contracts: (agentIds ?? []).map((id) => ({
      address: agentNftAddress,
      abi: agentNftAbi,
      functionName: "getAgent" as const,
      args: [id] as [bigint],
    })),
    query: { enabled: !!agentIds && agentIds.length > 0 },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {!agentIds || agentIds.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-monad-border rounded-lg">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentIds.map((id, i) => {
            const agent = agentResults?.[i]?.result as Agent | undefined;
            if (!agent) {
              return (
                <div key={id.toString()} className="border border-monad-border rounded-lg p-4 animate-pulse bg-monad-card">
                  <div className="h-4 bg-monad-border rounded w-3/4 mb-2" />
                  <div className="h-3 bg-monad-border rounded w-1/2" />
                </div>
              );
            }
            // Hide agents owned by test/deployer wallets
            if (TEST_ADDRESSES.has(agent.owner.toLowerCase())) return null;
            return (
              <AgentCard
                key={id.toString()}
                agent={agent}
                selected={selectedId === id}
                onClick={() => onSelect(id)}
              />
            );
          })}
        </div>
      )}
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

// ── Pending challenges ────────────────────────────────────────────────────────

function PendingChallenges({
  address,
  myAgentIds,
  allBattleIds,
  onAccept,
  isPending,
  isConfirming,
}: {
  address?: `0x${string}`;
  myAgentIds?: bigint[];
  allBattleIds?: bigint[];
  onAccept: (battleId: bigint) => void;
  isPending: boolean;
  isConfirming: boolean;
}) {
  const { agentNftAddress, agentNftAbi, battleArenaAddress, battleArenaAbi } = useContracts();
  const recentBattleIds = useMemo(() => allBattleIds?.slice(-50) ?? [], [allBattleIds]);

  // Batch-load all battles in one multicall
  const { data: battleResults } = useReadContracts({
    contracts: recentBattleIds.map((id) => ({
      address: battleArenaAddress,
      abi: battleArenaAbi,
      functionName: "getBattle" as const,
      args: [id] as [bigint],
    })),
    query: { enabled: recentBattleIds.length > 0 },
  });

  const battles = useMemo(
    () => battleResults?.map((r) => r.result as Battle | undefined) ?? [],
    [battleResults]
  );

  // Collect unique agent IDs only from pending battles where my agent is challenged
  const agentIdsNeeded = useMemo(() => {
    if (!myAgentIds) return [];
    const ids = new Set<bigint>();
    battles.forEach((b) => {
      if (!b || b.status !== 0) return;
      if (!myAgentIds.includes(b.challengedAgentId)) return;
      ids.add(b.challengerAgentId);
      ids.add(b.challengedAgentId);
    });
    return Array.from(ids);
  }, [battles, myAgentIds]);

  // Batch-load those agents in one multicall
  const { data: agentResults } = useReadContracts({
    contracts: agentIdsNeeded.map((id) => ({
      address: agentNftAddress,
      abi: agentNftAbi,
      functionName: "getAgent" as const,
      args: [id] as [bigint],
    })),
    query: { enabled: agentIdsNeeded.length > 0 },
  });

  const agentMap = useMemo(() => {
    const m = new Map<bigint, Agent>();
    agentIdsNeeded.forEach((id, i) => {
      const a = agentResults?.[i]?.result as Agent | undefined;
      if (a) m.set(id, a);
    });
    return m;
  }, [agentIdsNeeded, agentResults]);

  const pendingRows = useMemo(
    () =>
      recentBattleIds.reduce<Array<{ id: bigint; battle: Battle }>>((acc, id, i) => {
        const b = battles[i];
        if (!b || b.status !== 0) return acc;
        if (!myAgentIds?.includes(b.challengedAgentId)) return acc;
        acc.push({ id, battle: b });
        return acc;
      }, []),
    [recentBattleIds, battles, myAgentIds]
  );

  if (!pendingRows.length) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pending Challenges</h2>
      <div className="space-y-2">
        {pendingRows.map(({ id, battle }) => {
          const challengerAgent = agentMap.get(battle.challengerAgentId);
          const challengedAgent = agentMap.get(battle.challengedAgentId);
          if (!challengerAgent || !challengedAgent) return null;

          return (
            <div
              key={id.toString()}
              className="bg-monad-card border border-monad-border rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-monad-purple font-bold text-sm whitespace-nowrap">
                  #{id.toString()}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                  <span className="text-white truncate">{challengerAgent.name}</span>
                  <span className="text-gray-500">vs</span>
                  <span className="text-white truncate">{challengedAgent.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 whitespace-nowrap">Pending ⏳</span>
                <button
                  onClick={() => onAccept(id)}
                  disabled={isPending || isConfirming}
                  className="px-3 py-1.5 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 text-white text-xs font-bold rounded whitespace-nowrap"
                >
                  {isPending || isConfirming ? "..." : "Accept & Fight"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
