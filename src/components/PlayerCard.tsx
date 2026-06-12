"use client";

import { useEffect, useRef } from "react";
import type { Player, LeagueTier } from "@/types";

interface Props {
  player: Player;
  onClose: () => void;
}

const TIER_LABEL: Record<LeagueTier, string> = {
  top5eu:    "Top-5 European League",
  otherEu:   "European League",
  homeleague:"Home League",
  minor:     "Lower / Minor League",
};

const TIER_BG: Record<LeagueTier, string> = {
  top5eu:    "var(--tier-top5eu)",
  otherEu:   "var(--tier-otherEu)",
  homeleague:"var(--tier-home)",
  minor:     "var(--tier-minor)",
};

const TIER_COLOR: Record<LeagueTier, string> = {
  top5eu:    "#000",
  otherEu:   "#fff",
  homeleague:"#000",
  minor:     "#fff",
};

export default function PlayerCard({ player, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay tap (not on card itself)
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="player-card-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Player detail: ${player.name}`}
    >
      <div className="player-card">
        <div className="player-card__handle" />

        <button className="player-card__close" onClick={onClose} aria-label="Close">✕</button>

        <div className="player-card__header">
          <div
            className="player-card__number"
            style={{
              background: TIER_BG[player.leagueTier],
              color: TIER_COLOR[player.leagueTier],
            }}
          >
            {player.number || "–"}
          </div>
          <div className="player-card__info">
            <h2>{player.name}</h2>
            <p>{player.pos} · {player.club}</p>
          </div>
        </div>

        <div className="player-card__tags">
          <span className="tag">{player.pos}</span>
          <span className="tag">{TIER_LABEL[player.leagueTier]}</span>
          {player.clubLeague && <span className="tag">{player.clubLeague}</span>}
          {player.bornAbroad && (
            <span className="tag tag--abroad">⚪ Born abroad</span>
          )}
        </div>

        <div className="player-card__scout">
          {player.scoutNote
            ? `"${player.scoutNote}"`
            : <span style={{ color: "var(--text-muted)", fontStyle: "normal" }}>Loading scouting note…</span>
          }
        </div>
      </div>
    </div>
  );
}
