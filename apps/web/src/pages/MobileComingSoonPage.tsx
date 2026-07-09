import { Link } from "react-router-dom";

import { Card } from "../components/Card";

export function MobileComingSoonPage() {
  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Mobile-first experience, web demo today.</h1>
        <p>
          ArcLoop is designed for savings groups that coordinate from phones. This
          production MVP ships as a responsive web app while the native app remains planned.
        </p>
      </div>
      <div className="section-grid">
        <Card>
          <h2>Responsive now</h2>
          <p>Create, join, approve, and contribute flows are available in the browser.</p>
        </Card>
        <Card>
          <h2>Native later</h2>
          <p>The next phase can wrap the same Circle and Arc transaction flow in mobile UI.</p>
        </Card>
        <Card>
          <h2>Demo path</h2>
          <p>Use the web app to prove the full rotating savings lifecycle on Arc Testnet.</p>
        </Card>
      </div>
      <div className="button-row">
        <Link className="button primary" to="/pools">
          View pools
        </Link>
        <Link className="button secondary" to="/dashboard">
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
