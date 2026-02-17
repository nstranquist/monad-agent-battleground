"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  AGENT_REGISTRY_ADDRESS,
  AGENT_REGISTRY_ABI,
} from "@/lib/contracts";
import Link from "next/link";

const TOTAL_POINTS = 10;

export default function CreateAgentPage() {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ strength: 4, speed: 3, intelligence: 3 });
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const remaining = TOTAL_POINTS - stats.strength - stats.speed - stats.intelligence;

  const setStat = (key: keyof typeof stats, value: number) => {
    const others = TOTAL_POINTS - stats[key] - remaining;
    const newVal = Math.max(1, Math.min(8, value));
    const used = others + newVal;
    if (used > TOTAL_POINTS) return;
    setStats((s) => ({ ...s, [key]: newVal }));
  };

  const handleCreate = async () => {
    if (!name.trim() || remaining !== 0) return;
    try {
      const hash = await writeContractAsync({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "createAgent",
        args: [name.trim(), stats.strength, stats.speed, stats.intelligence],
      });
      setTxHash(hash);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-2xl font-bold">Connect to Deploy</h2>
        <p className="text-gray-400 mb-6">You need a wallet to create an agent.</p>
        <ConnectButton />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-24 space-y-4 animate-battle-flash">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold text-monad-purple">Agent Deployed!</h2>
        <p className="text-gray-400">
          <strong className="text-white">{name}</strong> is now registered onchain on Monad.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/arena"
            className="px-6 py-3 bg-monad-purple hover:bg-monad-purple/80 text-white font-bold rounded-lg"
          >
            Enter Arena →
          </Link>
          <button
            onClick={() => {
              setName("");
              setStats({ strength: 4, speed: 3, intelligence: 3 });
              setTxHash(null);
            }}
            className="px-6 py-3 border border-monad-border hover:border-monad-purple text-gray-300 rounded-lg"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Create Agent</h1>
        <p className="text-gray-400">
          Deploy your fighter onchain. Distribute <span className="text-monad-purple font-bold">10 stat points</span> strategically.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Agent Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 32))}
          placeholder="e.g. ShadowPulse, IronMind, VoltRush"
          maxLength={32}
          className="w-full bg-monad-card border border-monad-border hover:border-monad-purple/50 focus:border-monad-purple rounded-lg px-4 py-3 text-white outline-none transition-colors"
        />
        <div className="text-xs text-gray-600 text-right">{name.length}/32</div>
      </div>

      {/* Stats */}
      <div className="bg-monad-card border border-monad-border rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="font-bold">Stat Points</span>
          <span
            className={`text-sm font-mono ${remaining === 0 ? "text-green-400" : "text-monad-purple"}`}
          >
            {remaining > 0 ? `${remaining} remaining` : "✓ Ready"}
          </span>
        </div>

        <StatSlider
          label="⚔ Strength"
          description="Raw damage output"
          value={stats.strength}
          onChange={(v) => setStat("strength", v)}
          color="bg-red-500"
        />
        <StatSlider
          label="⚡ Speed"
          description="Attack priority"
          value={stats.speed}
          onChange={(v) => setStat("speed", v)}
          color="bg-yellow-400"
        />
        <StatSlider
          label="🧠 Intelligence"
          description="Strategy & adaptability"
          value={stats.intelligence}
          onChange={(v) => setStat("intelligence", v)}
          color="bg-blue-400"
        />
      </div>

      {/* Preview */}
      <div className="bg-monad-card border border-monad-border rounded-lg p-4 text-sm text-gray-400 space-y-1">
        <div className="font-bold text-white mb-2">Agent Preview</div>
        <div className="flex justify-between">
          <span>Name</span>
          <span className="text-white">{name || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>Build</span>
          <span className="text-monad-purple">
            {stats.strength}/{stats.speed}/{stats.intelligence} STR/SPD/INT
          </span>
        </div>
        <div className="flex justify-between">
          <span>Network</span>
          <span className="text-white">Monad Testnet</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleCreate}
        disabled={!name.trim() || remaining !== 0 || isPending || isConfirming}
        className="w-full py-4 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-lg"
      >
        {isPending
          ? "Confirm in wallet..."
          : isConfirming
          ? "⏳ Deploying on Monad..."
          : "Deploy Agent →"}
      </button>

      {!AGENT_REGISTRY_ADDRESS && (
        <div className="text-xs text-yellow-500 text-center border border-yellow-500/30 rounded p-3">
          ⚠ Contract not deployed yet. Run <code>npm run deploy:testnet</code> first.
        </div>
      )}
    </div>
  );
}

function StatSlider({
  label,
  description,
  value,
  onChange,
  color,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs">{description}</span>
          <span className="font-bold text-white w-4 text-right">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(value - 1)}
          className="w-7 h-7 rounded border border-monad-border hover:border-monad-purple text-white text-sm flex items-center justify-center transition-colors"
        >
          −
        </button>
        <div className="flex-1 stat-bar">
          <div
            className={`stat-bar-fill ${color}`}
            style={{ width: `${(value / 10) * 100}%` }}
          />
        </div>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded border border-monad-border hover:border-monad-purple text-white text-sm flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
