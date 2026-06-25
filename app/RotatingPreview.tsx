"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";

const TITLES = ["Company vesting", "Stakeholders", "Vesting statement"];

export default function RotatingPreview() {
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (!paused.current) setI((p) => (p + 1) % 3);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="preview"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="pv-top">
        <Logo size={24} className="pm" />
        <span className="pv-title">{TITLES[i]}</span>
        <span className="pv-dots">
          {[0, 1, 2].map((n) => (
            <i key={n} className={i === n ? "on" : ""} />
          ))}
        </span>
      </div>

      <div className="pv-stage">
        {/* frame 1: chart */}
        <div className={`pframe${i === 0 ? " active" : ""}`}>
          <div className="kpis">
            <div className="kpi">
              <b>847k</b>
              <span>Granted</span>
            </div>
            <div className="kpi">
              <b>312k</b>
              <span>Vested</span>
            </div>
            <div className="kpi">
              <b>37%</b>
              <span>Pool used</span>
            </div>
          </div>
          <div className="chartbox">
            <svg
              className="spark"
              width="100%"
              height="112"
              viewBox="0 0 460 112"
              preserveAspectRatio="none"
            >
              <path
                className="draw"
                d="M0,100 L70,100 L70,84 L150,84 L150,66 L230,66 L230,50 L310,50 L310,34 L390,34 L390,20 L460,20"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2"
                opacity={0.55}
              />
              <path
                className="draw"
                d="M0,104 L60,104 L60,90 L130,90 L130,74 L210,74 L210,58 L290,58 L290,40 L370,40 L370,24 L460,24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.6"
              />
            </svg>
          </div>
        </div>

        {/* frame 2: table */}
        <div className={`pframe${i === 1 ? " active" : ""}`}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Vested</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              <tr className="r">
                <td>A. Rivera</td>
                <td>18,000</td>
                <td>
                  <span className="pct">45%</span>
                  <div className="mini-bar">
                    <i style={{ width: "45%" }} />
                  </div>
                </td>
              </tr>
              <tr className="r">
                <td>J. Okafor</td>
                <td>9,500</td>
                <td>
                  <span className="pct">60%</span>
                  <div className="mini-bar">
                    <i style={{ width: "60%" }} />
                  </div>
                </td>
              </tr>
              <tr className="r">
                <td>S. Lindqvist</td>
                <td>24,200</td>
                <td>
                  <span className="pct">78%</span>
                  <div className="mini-bar">
                    <i style={{ width: "78%" }} />
                  </div>
                </td>
              </tr>
              <tr className="r">
                <td>M. Haddad</td>
                <td>4,000</td>
                <td>
                  <span className="pct">25%</span>
                  <div className="mini-bar">
                    <i style={{ width: "25%" }} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* frame 3: statement */}
        <div className={`pframe${i === 2 ? " active" : ""}`}>
          <div className="stmt">
            <div className="ring">
              <svg width="118" height="118" viewBox="0 0 118 118">
                <circle
                  className="ringtrack"
                  cx="59"
                  cy="59"
                  r="52"
                  fill="none"
                  strokeWidth="11"
                />
                <circle
                  className="ringval"
                  cx="59"
                  cy="59"
                  r="52"
                  fill="none"
                  strokeWidth="11"
                />
              </svg>
              <div className="rc">
                <b>45%</b>
                <span>Vested</span>
              </div>
            </div>
            <div className="who">
              <b>A. Rivera — Vesting statement</b>
              <p>
                4-year schedule · 1-year cliff · monthly thereafter. Cliff
                reached Apr 2025.
              </p>
              <div className="line">
                Vested <span>18,000</span> of 40,000 · next vest{" "}
                <span>1 Jul 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
