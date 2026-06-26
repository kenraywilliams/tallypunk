"use client";

import Link from "next/link";
import { useSandbox } from "./SandboxProvider";

export default function SandboxBar() {
  const { resetSandbox } = useSandbox();

  const reset = () => {
    if (
      window.confirm(
        "Reset the sandbox? This clears all pools, companies and history saved in this browser.",
      )
    ) {
      resetSandbox();
    }
  };

  return (
    <div className="sandbar">
      <div className="sandbar-l">
        <span className="sandbadge">SANDBOX</span>
        <span className="sandnote">
          You&rsquo;re trying TallyPunk with sample data, saved only in this
          browser.
        </span>
      </div>
      <div className="sandbar-r">
        <button className="sandlink" onClick={reset}>
          Reset sandbox
        </button>
        <Link className="btn btn-pri btn-sm" href="/">
          Create free account
        </Link>
      </div>
    </div>
  );
}
