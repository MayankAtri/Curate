import { NavLink } from 'react-router-dom';

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <NavLink to="/feed" className="logo">
          Curate
        </NavLink>
        <nav className="header-actions">
          <NavLink
            to="/feed"
            className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
          >
            Feed
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
          >
            Analytics
          </NavLink>
          <NavLink
            to="/preferences"
            className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
          >
            Preferences
          </NavLink>
          <NavLink
            to="/onboarding"
            className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
          >
            Onboarding
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
