export default function StakeholderGrantsPage() {
  return (
    <div className="panel">
      <div className="vrow">
        <span className="vlab">Total granted</span>
        <span className="vval">
          <span className="muted-cell">—</span>
        </span>
      </div>
      <div className="vrow">
        <span className="vlab">Total vested</span>
        <span className="vval">
          <span className="muted-cell">—</span>
        </span>
      </div>
      <p className="muted-note">
        No grants yet. Once the Grants page is live, this stakeholder&apos;s grants
        appear here as <strong>Grant 1</strong>, <strong>Grant 2</strong> … each a
        clickable button, with the running totals above.
      </p>
    </div>
  );
}
