"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AGENT_NFT_ADDRESS, AGENT_NFT_ABI } from "@/lib/contracts";
import Link from "next/link";

const TOTAL_POINTS = 10;

const PERSONALITY_EXAMPLES = [
  "Silent and calculating. Strikes once, ends it.",
  "Chaotic energy. Unpredictable, loves the crowd.",
  "Ruthless efficiency. No mercy, no hesitation.",
  "Ancient wisdom guides every move. Patient, precise.",
  "Pure aggression. First hit, last breath.",
];

export default function CreateAgentPage() {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ strength: 4, speed: 3, intelligence: 3 });
  const [personality, setPersonality] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const remaining = TOTAL_POINTS - stats.strength - stats.speed - stats.intelligence;

  const setStat = (key: keyof typeof stats, value: number) => {
    const others = TOTAL_POINTS - stats[key] - remaining;
    const newVal = Math.max(1, Math.min(8, value));
    if (others + newVal > TOTAL_POINTS) return;
    setStats((s) => ({ ...s, [key]: newVal }));
  };

  const handleCreate = async () => {
    if (!name.trim() || remaining !== 0) return;
    try {
      const hash = await writeContractAsync({
        address: AGENT_NFT_ADDRESS,
        abi: AGENT_NFT_ABI,
        functionName: "mint",
        args: [
          name.trim(),
          stats.strength,
          stats.speed,
          stats.intelligence,
          personality.trim(),
        ],
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
        <p className="text-gray-400 mb-6">Connect your Phantom wallet to mint your champion.</p>
        <ConnectButton />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold text-monad-purple">Champion Minted!</h2>
        <p className="text-gray-400 max-w-sm mx-auto">
          <strong className="text-white">{name}</strong> is now a soulbound NFT on Monad.
          Check your Phantom wallet — it&apos;s already there.
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
              setPersonality("");
              setTxHash(null);
            }}
            className="px-6 py-3 border border-monad-border hover:border-monad-purple text-gray-300 rounded-lg"
          >
            Mint Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Mint Your Champion</h1>
        <p className="text-gray-400">
          A soulbound NFT on Monad. Yours forever — can never be sold or transferred.
          Distribute <span className="text-monad-purple font-bold">10 stat points</span> and
          define your agent&apos;s personality.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400 font-medium">Agent Name</label>
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
      <div className="bg-monad-card border border-monad-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">Stat Distribution</span>
          <span className={`text-sm font-mono ${remaining === 0 ? "text-green-400" : "text-monad-purple"}`}>
            {remaining > 0 ? `${remaining} pts remaining` : "✓ Ready"}
          </span>
        </div>
        <StatSlider label="⚔ Strength" description="Raw power" value={stats.strength} onChange={(v) => setStat("strength", v)} color="bg-red-500" />
        <StatSlider label="⚡ Speed" description="Attack priority" value={stats.speed} onChange={(v) => setStat("speed", v)} color="bg-yellow-400" />
        <StatSlider label="🧠 Intelligence" description="Adaptability" value={stats.intelligence} onChange={(v) => setStat("intelligence", v)} color="bg-blue-400" />
      </div>

      {/* Personality */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-400 font-medium">
            Personality Prompt <span className="text-gray-600">(optional)</span>
          </label>
          <span className="text-xs text-gray-600">{personality.length}/200</span>
        </div>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value.slice(0, 200))}
          placeholder="How does your agent fight? This shapes the battle narrative Claude writes..."
          rows={3}
          maxLength={200}
          className="w-full bg-monad-card border border-monad-border hover:border-monad-purple/50 focus:border-monad-purple rounded-lg px-4 py-3 text-white outline-none transition-colors resize-none text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPersonality(ex)}
              className="text-xs px-2 py-1 border border-monad-border hover:border-monad-purple text-gray-500 hover:text-monad-purple rounded transition-colors"
            >
              {ex.slice(0, 28)}…
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-monad-card border border-monad-border rounded-lg p-4 text-sm space-y-2">
        <div className="font-bold text-white mb-1">Preview</div>
        <div className="flex justify-between text-gray-400">
          <span>Name</span><span className="text-white">{name || "—"}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Build</span>
          <span className="text-monad-purple">{stats.strength}/{stats.speed}/{stats.intelligence} STR/SPD/INT</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Type</span><span className="text-white">Soulbound NFT</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Network</span><span className="text-white">Monad Testnet (10143)</span>
        </div>
        {personality && (
          <div className="pt-1 border-t border-monad-border text-gray-500 italic text-xs">
            &quot;{personality.slice(0, 80)}{personality.length > 80 ? "…" : ""}&quot;
          </div>
        )}
      </div>

      <button
        onClick={handleCreate}
        disabled={!name.trim() || remaining !== 0 || isPending || isConfirming}
        className="w-full py-4 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-lg"
      >
        {isPending ? "Confirm in Phantom..." : isConfirming ? "⏳ Minting on Monad..." : "Mint Champion →"}
      </button>

      {!AGENT_NFT_ADDRESS && (
        <div className="text-xs text-yellow-500 text-center border border-yellow-500/30 rounded p-3">
          ⚠ Contract not deployed. Run <code>npm run deploy:testnet</code> first.
        </div>
      )}
    </div>
  );
}

function StatSlider({ label, description, value, onChange, color }: {
  label: string; description: string; value: number;
  onChange: (v: number) => void; color: string;
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
        <button onClick={() => onChange(value - 1)} className="w-7 h-7 rounded border border-monad-border hover:border-monad-purple text-white text-sm flex items-center justify-center transition-colors">−</button>
        <div className="flex-1 stat-bar">
          <div className={`stat-bar-fill ${color}`} style={{ width: `${(value / 10) * 100}%` }} />
        </div>
        <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded border border-monad-border hover:border-monad-purple text-white text-sm flex items-center justify-center transition-colors">+</button>
      </div>
    </div>
  );
}
