"use client";

import type { Player } from "@/types";

interface Props {
  player: Player;
  subbedOff?: boolean;
  onClick: (player: Player) => void;
}

const TIER_CLASS: Record<string, string> = {
  top5eu:    "player-token__circle--top5eu",
  otherEu:   "player-token__circle--otherEu",
  homeleague:"player-token__circle--homeleague",
  minor:     "player-token__circle--minor",
};

export default function PlayerToken({ player, subbedOff, onClick }: Props) {
  const lastName = player.name.split(" ").slice(-1)[0];
  const tierClass = TIER_CLASS[player.leagueTier] ?? "player-token__circle--minor";
  const abroadClass = player.bornAbroad ? " player-token__circle--abroad" : "";
  const suboffClass = subbedOff ? " player-token__suboff" : "";

  return (
    <button
      className="player-token"
      onClick={() => onClick(player)}
      aria-label={`${player.name}, #${player.number}, ${player.pos}`}
    >
      <span className={`player-token__circle${tierClass ? " " + tierClass : ""}${abroadClass}${suboffClass}`}>
        {player.number || player.pos}
      </span>
      <span className="player-token__name">{lastName}</span>
    </button>
  );
}
