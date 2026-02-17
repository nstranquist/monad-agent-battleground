"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import {
  AGENT_REGISTRY_ADDRESS,
  AGENT_REGISTRY_ABI,
  BATTLE_ARENA_ADDRESS,
  BATTLE_ARENA_ABI,
  BATTLE_STAKE,
} from "@/lib/contracts";
import { AgentCard } from "@/components/AgentCard";
import { Agent, Battle } from "@/lib/types";

type Step = "select-my-agent" | "select-opponent" | "battle-result";

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

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Load all agent IDs
  const { data: allAgentIds, refetch: refetchAgents } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAllAgentIds",
  });

  // Load my agent IDs
  const { data: myAgentIds } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
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

  // Once tx confirmed, fetch narrative
  const fetchNarrative = useCallback(
    async (bid: bigint) => {
      setNarrativeLoading(true);
      try {
        const res = await fetch("/api/narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ battleId: bid.toString() }),
        });
        const data = await res.json();
        setNarrative(data.narrative);
      } catch (e) {
        setNarrative("The battle was too intense to describe...");
      } finally {
        setNarrativeLoading(false);
      }
    },
    []
  );

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
        {["select-my-agent", "select-opponent", "battle-result"].map(
          (s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s
                    ? "bg-monad-purple text-white"
                    : i < ["select-my-agent", "select-opponent", "battle-result"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-monad-border text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={step === s ? "text-white" : "text-gray-500"}
              >
                {s === "select-my-agent"
                  ? "Your Agent"
                  : s === "select-opponent"
                  ? "Opponent"
                  : "Fight!"}
              </span>
              {i < 2 && <span className="text-gray-600">→</span>}
            </div>
          )
        )}
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

      {/* Step 2: Select opponent */}
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
                ? "⏳ Battle happening..."
                : `⚔ FIGHT! (stake ${formatEther(BATTLE_STAKE)} MON)`}
            </button>
          </div>
        </AgentSelector>
      )}

      {/* Pending Challenges Section */}
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
  showChallenge,
  onChallenge,
}: {
  agentId: bigint;
  selected?: boolean;
  onClick?: () => void;
  showChallenge?: boolean;
  onChallenge?: () => void;
}) {
  const { data: agent } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
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
      showChallenge={showChallenge}
      onChallenge={onChallenge}
    />
  );
}

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
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: battle ? [battle.challengerAgentId] : undefined,
    query: { enabled: !!battle },
  });

  const { data: challengedAgent } = useReadContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: battle ? [battle.challengedAgentId] : undefined,
    query: { enabled: !!battle },
  });

  if (!battle || !challengerAgent || !challengedAgent) return null;

  const isMyChallengedAgent = myAgentIds?.includes(battle.challengedAgentId);
  const statusLabel = ["Pending ⏳", "Completed ✅", "Cancelled ❌"][
    battle.status
  ];
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
          <span className="text-white truncate">
            {(challengerAgent as Agent).name}
          </span>
          <span className="text-gray-500">vs</span>
          <span className="text-white truncate">
            {(challengedAgent as Agent).name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {winnerName && (
          <span className="text-green-400 text-xs font-bold whitespace-nowrap">
            🏆 {winnerName}
          </span>
        )}
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {statusLabel}
        </span>
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
