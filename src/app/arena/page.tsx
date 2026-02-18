"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import {
  AGENT_NFT_ADDRESS,
  AGENT_NFT_ABI,
  BATTLE_ARENA_ADDRESS,
  BATTLE_ARENA_ABI,
  BATTLE_STAKE,
} from "@/lib/contracts";
import { AgentCard } from "@/components/AgentCard";
import { Agent, Battle } from "@/lib/types";

type Step = "select-my-agent" | "select-opponent" | "battling" | "battle-result";

export default function ArenaPage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>("select-my-agent");
  const [myAgentId, setMyAgentId] = useState<bigint | null>(null);
  const [opponentAgentId, setOpponentAgentId] = useState<bigint | null>(null);
  const [battleId, setBattleId] = useState<bigint | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [pendingBattleId, setPendingBattleId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [resolvedBattleId, setResolvedBattleId] = useState<bigint | null>(null);
  const [clashPhase, setClashPhase] = useState<"idle" | "charging" | "clash" | "done">("idle");

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Load all agent IDs
  const { data: allAgentIds } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAllAgentIds",
  });

  // Load my agent IDs
  const { data: myAgentIds } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getOwnerAgents",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Load all battles
  const { data: allBattleIds } = useReadContract({
    address: BATTLE_ARENA_ADDRESS,
    abi: BATTLE_ARENA_ABI,
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

    // Clash animation sequence
    const t1 = setTimeout(() => setClashPhase("clash"), 800);
    const t2 = setTimeout(() => {
      setClashPhase("done");
      setStep("battle-result");
      fetchNarrative(bid);
    }, 1800);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isSuccess]);

  const handleChallenge = async () => {
    if (!myAgentId || !opponentAgentId) return;
    try {
      const hash = await writeContractAsync({
        address: BATTLE_ARENA_ADDRESS,
        abi: BATTLE_ARENA_ABI,
        functionName: "challenge",
        args: [myAgentId, opponentAgentId],
        value: BATTLE_STAKE,
      });
      setTxHash(hash);
      setBattleId(null); // will be resolved from contract
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptChallenge = async (bid: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: BATTLE_ARENA_ADDRESS,
        abi: BATTLE_ARENA_ABI,
        functionName: "acceptChallenge",
        args: [bid],
        value: BATTLE_STAKE,
      });
      setTxHash(hash);
      setPendingBattleId(bid);
    } catch (e) {
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
            {formatEther(BATTLE_STAKE)} MON
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
                : `⚔ FIGHT! (stake ${formatEther(BATTLE_STAKE)} MON)`}
            </button>
          </div>
        </AgentSelector>
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

// ── Clash animation screen ────────────────────────────────────────────────────

function ClashScreen({
  myAgentId,
  opponentAgentId,
  phase,
}: {
  myAgentId: bigint | null;
  opponentAgentId: bigint | null;
  phase: "idle" | "charging" | "clash" | "done";
}) {
  const { data: myAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: myAgentId ? [myAgentId] : undefined,
    query: { enabled: !!myAgentId },
  }) as { data: Agent | undefined };

  const { data: oppAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: opponentAgentId ? [opponentAgentId] : undefined,
    query: { enabled: !!opponentAgentId },
  }) as { data: Agent | undefined };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <h2 className="text-2xl font-bold text-monad-purple animate-pulse">
        Battle in progress...
      </h2>

      <div className="flex items-center gap-8 w-full max-w-lg">
        {/* My fighter */}
        <div
          className={`flex-1 text-center transition-all duration-700 ${
            phase === "charging" ? "battle-slide-left" :
            phase === "clash" ? "battle-shake" : ""
          }`}
        >
          <div className="text-5xl mb-2">🤖</div>
          <div className="font-bold text-white">{myAgent?.name ?? "..."}</div>
          <div className="text-xs text-monad-purple mt-1">
            {myAgent ? `${myAgent.strength}/${myAgent.speed}/${myAgent.intelligence}` : ""}
          </div>
        </div>

        {/* Clash effect */}
        <div className="relative w-16 flex-shrink-0 flex items-center justify-center">
          {phase === "clash" && (
            <div className="text-4xl battle-flash">⚡</div>
          )}
          {phase !== "clash" && (
            <div className="text-2xl text-gray-600">⚔</div>
          )}
        </div>

        {/* Opponent */}
        <div
          className={`flex-1 text-center transition-all duration-700 ${
            phase === "charging" ? "battle-slide-right" :
            phase === "clash" ? "battle-shake" : ""
          }`}
        >
          <div className="text-5xl mb-2">🤖</div>
          <div className="font-bold text-white">{oppAgent?.name ?? "..."}</div>
          <div className="text-xs text-monad-purple mt-1">
            {oppAgent ? `${oppAgent.strength}/${oppAgent.speed}/${oppAgent.intelligence}` : ""}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 animate-pulse">
        Resolving on Monad...
      </p>
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
  const { data: battle } = useReadContract({
    address: BATTLE_ARENA_ADDRESS,
    abi: BATTLE_ARENA_ABI,
    functionName: "getBattle",
    args: [battleId],
  }) as { data: Battle | undefined };

  const { data: winnerAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: battle?.winnerAgentId ? [battle.winnerAgentId] : undefined,
    query: { enabled: !!battle?.winnerAgentId },
  }) as { data: Agent | undefined };

  const { data: challengerAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: battle?.challengerAgentId ? [battle.challengerAgentId] : undefined,
    query: { enabled: !!battle },
  }) as { data: Agent | undefined };

  const { data: challengedAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
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
            Payout: {formatEther(BATTLE_STAKE * 2n)} MON · Battle #{battleId.toString()}
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
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {!agentIds || agentIds.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-monad-border rounded-lg">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentIds.map((id) => (
            <AgentCardLoader
              key={id.toString()}
              agentId={id}
              selected={selectedId === id}
              onClick={() => onSelect(id)}
            />
          ))}
        </div>
      )}
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

function AgentCardLoader({
  agentId,
  selected,
  onClick,
}: {
  agentId: bigint;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { data: agent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: [agentId],
  });

  if (!agent) {
    return (
      <div className="border border-monad-border rounded-lg p-4 animate-pulse bg-monad-card">
        <div className="h-4 bg-monad-border rounded w-3/4 mb-2" />
        <div className="h-3 bg-monad-border rounded w-1/2" />
      </div>
    );
  }

  return (
    <AgentCard
      agent={agent as Agent}
      selected={selected}
      onClick={onClick}
    />
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
  if (!allBattleIds || allBattleIds.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pending Challenges</h2>
      <div className="space-y-2">
        {allBattleIds.slice(-10).map((id) => (
          <BattleRow
            key={id.toString()}
            battleId={id}
            myAgentIds={myAgentIds}
            onAccept={onAccept}
            isPending={isPending}
            isConfirming={isConfirming}
          />
        ))}
      </div>
    </div>
  );
}

function BattleRow({
  battleId,
  myAgentIds,
  onAccept,
  isPending,
  isConfirming,
}: {
  battleId: bigint;
  myAgentIds?: bigint[];
  onAccept: (id: bigint) => void;
  isPending: boolean;
  isConfirming: boolean;
}) {
  const { data: battle } = useReadContract({
    address: BATTLE_ARENA_ADDRESS,
    abi: BATTLE_ARENA_ABI,
    functionName: "getBattle",
    args: [battleId],
  }) as { data: Battle | undefined };

  const { data: challengerAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: battle ? [battle.challengerAgentId] : undefined,
    query: { enabled: !!battle },
  });

  const { data: challengedAgent } = useReadContract({
    address: AGENT_NFT_ADDRESS,
    abi: AGENT_NFT_ABI,
    functionName: "getAgent",
    args: battle ? [battle.challengedAgentId] : undefined,
    query: { enabled: !!battle },
  });

  if (!battle || !challengerAgent || !challengedAgent) return null;

  const isMyChallengedAgent = myAgentIds?.includes(battle.challengedAgentId);
  const statusLabel = ["Pending ⏳", "Completed ✅", "Cancelled ❌"][battle.status];
  const winnerName =
    battle.status === 1 && battle.winnerAgentId
      ? battle.winnerAgentId === battle.challengerAgentId
        ? (challengerAgent as Agent).name
        : (challengedAgent as Agent).name
      : null;

  return (
    <div className="bg-monad-card border border-monad-border rounded-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-monad-purple font-bold text-sm whitespace-nowrap">
          #{battleId.toString()}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
          <span className="text-white truncate">{(challengerAgent as Agent).name}</span>
          <span className="text-gray-500">vs</span>
          <span className="text-white truncate">{(challengedAgent as Agent).name}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {winnerName && (
          <span className="text-green-400 text-xs font-bold whitespace-nowrap">
            🏆 {winnerName}
          </span>
        )}
        <span className="text-xs text-gray-500 whitespace-nowrap">{statusLabel}</span>
        {battle.status === 0 && isMyChallengedAgent && (
          <button
            onClick={() => onAccept(battleId)}
            disabled={isPending || isConfirming}
            className="px-3 py-1.5 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 text-white text-xs font-bold rounded whitespace-nowrap"
          >
            {isPending || isConfirming ? "..." : "Accept & Fight"}
          </button>
        )}
      </div>
    </div>
  );
}
