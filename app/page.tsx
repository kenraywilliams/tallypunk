import RotatingPreview from "./RotatingPreview";

const BrandMark = () => (
  <svg
    className="mark"
    viewBox="0 0 28 24"
    width="26"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
  >
    <path d="M4 4v16M10 4v16M16 4v16M22 4v16M1.5 20.5 25.5 3.5" />
  </svg>
);

export default function Home() {
  return (
    <div className="lp">
      <nav className="nav">
        <div className="brand">
          <BrandMark />
          TallyPunk
        </div>
        <div className="navlinks">
          <a href="#">Calculators</a>
          <a href="#">Learn</a>
          <a href="#">Pricing</a>
        </div>
        <div className="navright">
          <a className="login" href="#">
            Log in
          </a>
          <a className="btn btn-pri btn-sm" href="#">
            Sign up free
          </a>
        </div>
      </nav>

      <section className="hero">
        <div>
          <span className="eyebrow">Equity, made legible</span>
          <h1 className="h1">The calm home for your company&rsquo;s equity.</h1>
          <p className="sub">
            Track pools, grants and vesting — and hand your team the equity
            statements they actually want. Clear, fast, refreshingly simple.
          </p>

          <RotatingPreview />
        </div>

        <div className="card">
          <h3>Create your free account</h3>
          <p className="cs">Free up to 10 stakeholders · no card required.</p>
          <button className="gbtn" type="button">
            <span className="gic">G</span> Continue with Google
          </button>
          <div className="orline">or</div>
          <label className="lab" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            className="inp"
            type="email"
            placeholder="you@company.com"
          />
          <button
            className="btn btn-pri btn-block"
            type="button"
            style={{ marginTop: 16 }}
          >
            Create free account
          </button>
          <p className="fine">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </section>

      <div className="trust">
        <span>
          <span className="tick">✓</span> Set up in minutes
        </span>
        <span>
          <span className="tick">✓</span> CSV import and export
        </span>
        <span>
          <span className="tick">✓</span> Cancel or edit any grant in one click
        </span>
        <span>
          <span className="tick">✓</span> Free up to 10 stakeholders
        </span>
      </div>
    </div>
  );
}
