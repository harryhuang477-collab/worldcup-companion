"use client";

import { useState, useCallback } from "react";
import PlayerToken from "./PlayerToken";
import PlayerCard from "./PlayerCard";
import type { Player, TeamSheet, MatchEvent } from "@/types";

interface Props {
  sheet: TeamSheet;
  events: MatchEvent[];
}

/**
 * Renders the floodlit vertical pitch with players positioned by formation.
 *
 * Layout convention (top = attacking end, bottom = GK):
 *   - We render the home team attacking upward (GK at bottom row)
 *   - formation.lines describes outfield rows from GK outward
 *     e.g. 4-3-3 → [4 defenders, 3 midfielders, 3 forwards]
 *
 * The pitch is divided into equal horizontal bands:
 *   GK row + N formation rows, evenly distributed from ~10% to ~90% height.
 */
export default function PitchView({ sheet, events }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Which players have been subbed off?
  const subbedOffNames = new Set(
    events.filter((e) => e.type === "subst").map((e) => e.playerOut).filter(Boolean) as string[]
  );

  function isSubbedOff(player: Player): boolean {
    return subbedOffNames.has(player.name);
  }

  const handleToken = useCallback((p: Player) => setSelectedPlayer(p), []);
  const handleClose = useCallback(() => setSelectedPlayer(null), []);

  // Split starters into GK + formation rows
  const gk = sheet.starters.filter((p) => p.pos === "G");
  const outfield = sheet.starters.filter((p) => p.pos !== "G");

  // Build formation rows from formation.lines (each number = players in that row)
  // lines go from defensive to attacking; we render GK at bottom, then defensive row up
  const formationLines = sheet.formation.lines.length > 0
    ? sheet.formation.lines
    : [4, 3, 3]; // fallback 4-3-3

  const rows: Player[][] = [];
  let cursor = 0;
  for (const count of formationLines) {
    rows.push(outfield.slice(cursor, cursor + count));
    cursor += count;
  }
  // Any remaining outfield players (if lineup mismatch) go in last row
  if (cursor < outfield.length) {
    rows[rows.length - 1] = [...(rows[rows.length - 1] ?? []), ...outfield.slice(cursor)];
  }

  // All rows for layout: GK at bottom (index 0), then outfield rows bottom→top
  // We reverse so GK renders at bottom of pitch visually
  const allRows = [[...gk], ...rows]; // [GK, def, mid, att]

  // Vertical positions: distribute rows evenly from 88% (GK) to 12% (attackers)
  const totalRows = allRows.length;
  const positions = allRows.map((_, i) => {
    const t = totalRows === 1 ? 0.5 : i / (totalRows - 1);
    return 88 - t * 76; // 88% (bottom) → 12% (top)
  });

  return (
    <>
      <div className="pitch">
        {allRows.map((rowPlayers, rowIdx) => (
          <div
            key={rowIdx}
            className="formation-row"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${positions[rowIdx]}%`,
              transform: "translateY(-50%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {rowPlayers.map((player) => (
              <PlayerToken
                key={player.id || player.name}
                player={player}
                subbedOff={isSubbedOff(player)}
                onClick={handleToken}
              />
            ))}
          </div>
        ))}
      </div>

      {selectedPlayer && (
        <PlayerCard player={selectedPlayer} onClose={handleClose} />
      )}
    </>
  );
}
