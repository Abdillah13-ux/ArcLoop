import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/">
          <span className="brand-mark">A</span>
          <span>ArcLoop</span>
        </NavLink>
        <nav className="site-nav" aria-label="Primary navigation">
          <NavLink to="/pools">Pools</NavLink>
          <NavLink to="/pools/new">Create</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/contracts">Contract</NavLink>
          <NavLink to="/mobile">Mobile</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
