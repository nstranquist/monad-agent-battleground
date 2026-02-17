import Link from "next/link";

const FEATURES = [
  {
    icon: "🤖",
    title: "Deploy Your Agent",
    desc: "Mint an AI agent onchain. Distribute 10 stat points across Strength, Speed, and Intelligence.",
  },
  {
    icon: "⚔",
    title: "Challenge & Stake",
    desc: "Challenge any agent to a battle. Both sides stake 0.001 MON. Winner takes all (minus 5% fee).",
  },
  {
    icon: "⚡",
    title: "Monad Speed",
    desc: "Battles resolve in milliseconds. Sub-second finality, 10k TPS — no waiting, instant dopamine.",
  },
  {
    icon: "✨",
    title: "AI Narrative",
    desc: "Claude generates a unique battle story for every fight. Every battle, a different legend.",
  },
];

const STATS = [
  { label: "TPS on Monad", value: "10,000+" },
  { label: "Finality", value: "<1s" },
  { label: "Battle Stake", value: "0.001 MON" },
  { label: "To fun", value: "<1 min" },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-16 space-y-6">
        <div className="inline-block px-3 py-1 text-xs border border-monad-purple text-monad-purple rounded-full mb-4">
          Built on Monad Testnet
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight">
          <span className="text-white">Agent</span>
          <br />
          <span className="text-monad-purple">Battle Arena</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Deploy your AI agent. Challenge rivals. Win MON.
          <br />
          Every battle resolved onchain in milliseconds.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/create"
            className="px-6 py-3 bg-monad-purple hover:bg-monad-purple/80 text-white font-bold rounded-lg transition-colors glow-purple"
          >
            Create Agent →
          </Link>
          <Link
            href="/arena"
            className="px-6 py-3 border border-monad-border hover:border-monad-purple text-gray-300 hover:text-white font-bold rounded-lg transition-colors"
          >
            Enter Arena
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="bg-monad-card border border-monad-border rounded-lg p-4 text-center"
          >
            <div className="text-2xl font-bold text-monad-purple">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold mb-8 text-center">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="bg-monad-card border border-monad-border rounded-lg p-6 hover:border-monad-purple/50 transition-colors"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-bold text-white mb-2">{f.title}</div>
              <div className="text-sm text-gray-400">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-8 border border-monad-border rounded-xl bg-monad-card">
        <div className="text-monad-purple text-4xl mb-4">⚔</div>
        <h3 className="text-2xl font-bold mb-2">Ready to fight?</h3>
        <p className="text-gray-400 mb-6">
          Connect your wallet and enter the arena.
        </p>
        <Link
          href="/create"
          className="px-8 py-3 bg-monad-purple hover:bg-monad-purple/80 text-white font-bold rounded-lg transition-colors"
        >
          Deploy Your Agent
        </Link>
      </section>
    </div>
  );
}
