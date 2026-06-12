"use client";

export default function Legend() {
  return (
    <div className="legend" aria-label="Token colour legend">
      <div className="legend__item">
        <span className="legend__dot" style={{ background: "var(--tier-top5eu)" }} />
        Top-5 EU
      </div>
      <div className="legend__item">
        <span className="legend__dot" style={{ background: "var(--tier-otherEu)" }} />
        Other EU
      </div>
      <div className="legend__item">
        <span className="legend__dot" style={{ background: "var(--tier-home)" }} />
        Home League
      </div>
      <div className="legend__item">
        <span className="legend__dot" style={{ background: "var(--tier-minor)" }} />
        Minor League
      </div>
      <div className="legend__item">
        <span className="legend__ring" />
        Born abroad
      </div>
    </div>
  );
}
