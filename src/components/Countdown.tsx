"use client";

import { useState, useEffect } from "react";

interface Props {
  kickoff: string; // ISO string
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function Countdown({ kickoff }: Props) {
  const [remaining, setRemaining] = useState<number>(
    new Date(kickoff).getTime() - Date.now()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(kickoff).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [kickoff]);

  return (
    <div className="countdown" aria-live="polite" aria-label="Countdown to kickoff">
      {remaining > 0 ? formatDuration(remaining) : "Kicking off…"}
    </div>
  );
}
