export default function Dashboard() {
  return (
    <div className="dash">
      <div className="dash-head">
        <h1 className="dash-title">Dashboard</h1>
        <span className="dash-pill">placeholder — designed last</span>
      </div>

      <div className="grid">
        <div className="box kpi">
          <div className="l">Total granted</div>
          <div className="g" />
        </div>
        <div className="box kpi">
          <div className="l">Vested</div>
          <div className="g" />
        </div>
        <div className="box kpi">
          <div className="l">Pool used</div>
          <div className="g" />
        </div>
        <div className="box kpi">
          <div className="l">Stakeholders</div>
          <div className="g" />
        </div>

        <div className="box chart">
          <div className="l-top">Company vesting</div>
          <div className="ghostline">
            <svg viewBox="0 0 600 150" preserveAspectRatio="none">
              <path
                d="M0,130 L100,130 L100,108 L200,108 L200,86 L300,86 L300,64 L400,64 L400,42 L500,42 L500,24 L600,24"
                fill="none"
                stroke="var(--line)"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        </div>

        <div className="box side">
          <div className="l-top">Vesting this month</div>
          <div className="g" style={{ width: "100%" }} />
          <div className="g" style={{ width: "82%" }} />
          <div className="g" style={{ width: "66%" }} />
          <div className="g" style={{ width: "90%" }} />
          <div className="g" style={{ width: "74%" }} />
        </div>
      </div>
    </div>
  );
}
