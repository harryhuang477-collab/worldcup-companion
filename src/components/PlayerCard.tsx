"use client";

import { useEffect, useRef } from "react";
import type { Player, LeagueTier } from "@/types";

interface Props {
  player: Player;
  onClose: () => void;
}

const TIER_LABEL: Record<LeagueTier, string> = {
  top5eu:     "Top-5 European League",
  otherEu:    "European League",
  homeleague: "Home League",
  minor:      "Club League",
};

const TIER_BG: Record<LeagueTier, string> = {
  top5eu:     "var(--tier-top5eu)",
  otherEu:    "var(--tier-otherEu)",
  homeleague: "var(--tier-home)",
  minor:      "var(--tier-minor)",
};

const TIER_COLOR: Record<LeagueTier, string> = {
  top5eu:     "#000",
  otherEu:    "#fff",
  homeleague: "#000",
  minor:      "#fff",
};

const POS_FULL: Record<string, string> = {
  G: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Forward",
};

export default function PlayerCard({ player, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const posLabel = POS_FULL[player.pos] ?? player.pos;
  const tierColor = TIER_BG[player.leagueTier];
  const tierTextColor = TIER_COLOR[player.leagueTier];

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

        {/* Header */}
        <div className="player-card__header">
          <div
            className="player-card__number"
            style={{ background: tierColor, color: tierTextColor }}
          >
            {player.number || "–"}
          </div>
          <div className="player-card__info">
            <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{player.name}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{posLabel}</p>
          </div>
        </div>

        {/* Club & League block */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 10,
          padding: "12px 14px",
          margin: "12px 0",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Club</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{player.club || "–"}</span>
          </div>
          {player.clubLeague && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>League</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{player.clubLeague}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Level</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
              background: tierColor, color: tierTextColor,
            }}>
              {TIER_LABEL[player.leagueTier]}
            </span>
          </div>
          {player.bornAbroad && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Origin</span>
              <span style={{ fontSize: 12, color: "var(--accent)" }}>⚪ Born abroad</span>
            </div>
          )}
        </div>

        {/* Scout note */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Scout Report
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
