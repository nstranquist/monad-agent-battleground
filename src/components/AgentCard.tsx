"use client";

import { Agent } from "@/lib/types";

const STAT_COLORS = {
  strength: "bg-red-500",
  speed: "bg-yellow-400",
  intelligence: "bg-blue-400",
};

const CLASS_LABEL: Record<string, string> = {
  "8-1-1": "BERSERKER",
  "1-8-1": "SPEEDSTER",
  "1-1-8": "ORACLE",
  "4-4-2": "TACTICIAN",
  "4-2-4": "SORCERER",
  "2-4-4": "PHANTOM",
  "3-3-4": "SAGE",
  "3-4-3": "RANGER",
  "4-3-3": "WARRIOR",
};

function getClass(str: number, spd: number, intel: number): string {
  const key = `${str}-${spd}-${intel}`;
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  const max = Math.max(str, spd, intel);
  if (max === str) return "BRUTE";
  if (max === spd) return "SPEEDSTER";
  return "MYSTIC";
}

// Avoid ReferenceError
const STAT_LABELS = CLASS_LABEL;

interface AgentCardProps {
  agent: Agent;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  showChallenge?: boolean;
  onChallenge?: () => void;
}

export function AgentCard({
  agent,
  selected,
  onClick,
  compact,
  showChallenge,
  onChallenge,
}: AgentCardProps) {
  const winRate =
    agent.wins + agent.losses > 0
      ? Math.round((Number(agent.wins) / (Number(agent.wins) + Number(agent.losses))) * 100)
      : null;

  const agentClass = getClass(agent.strength, agent.speed, agent.intelligence);

  return (
    <div
      onClick={onClick}
      className={`
        relative border rounded-lg p-4 transition-all duration-200
        ${onClick ? "cursor-pointer" : ""}
        ${
          selected
            ? "border-monad-purple bg-monad-purple/10 glow-purple"
            : "border-monad-border bg-monad-card hover:border-monad-purple/50"
        }
        ${compact ? "p-3" : ""}
      `}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-monad-purple animate-pulse" />
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-bold text-white">{agent.name}</span>
          </div>
          <div className="text-xs text-monad-purple mt-0.5">{agentClass}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">#{agent.id.toString()}</div>
          {winRate !== null && (
            <div className="text-xs text-green-400">{winRate}% WR</div>
          )}
        </div>
      </div>

      {!compact && (
        <div className="space-y-2 mb-3">
          <StatBar
            label="STR"
            value={agent.strength}
            color={STAT_COLORS.strength}
          />
          <StatBar
            label="SPD"
            value={agent.speed}
            color={STAT_COLORS.speed}
          />
          <StatBar
            label="INT"
            value={agent.intelligence}
            color={STAT_COLORS.intelligence}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="text-green-400">
            {agent.wins.toString()}W
          </span>
          <span className="text-red-400">
            {agent.losses.toString()}L
          </span>
        </div>
        {showChallenge && onChallenge && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChallenge();
            }}
            className="text-xs px-3 py-1 bg-monad-purple hover:bg-monad-purple/80 rounded font-bold transition-colors"
          >
            ⚔ CHALLENGE
          </button>
        )}
      </div>
    </div>
  );
}

function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-7">{label}</span>
      <div className="flex-1 stat-bar">
        <div
          className={`stat-bar-fill ${color}`}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-xs text-white w-3">{value}</span>
    </div>
  );
}
