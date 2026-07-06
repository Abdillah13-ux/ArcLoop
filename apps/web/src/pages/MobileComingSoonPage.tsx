import { Link } from "react-router-dom";

import { Card } from "../components/Card";

export function MobileComingSoonPage() {
  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Native mobile app planned after funding</h1>
        <p>
          This web app is the public demo and submission frontend for ArcLoop. The native
          app remains planned for a later phase.
        </p>
      </div>
      <Card>
        <h2>Current submission scope</h2>
        <p>
          This milestone focuses on a clear read-only web preview of fixed USDC contributions,
          payout order, settlement status, and verifiable pool metadata.
        </p>
        <Link className="button primary full-width" to="/">
          Back to web demo
        </Link>
      </Card>
    </div>
  );
}
