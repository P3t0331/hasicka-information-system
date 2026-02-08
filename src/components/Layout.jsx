import React from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { logout, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Helper to check active link
  const isActive = (path) => location.pathname === path;

  // Check admin access
  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
  const isAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

  // Close menu when route changes
  React.useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

  // Navigation Items Component for reuse
  const NavItems = ({ mobile = false }) => (
    <>
      <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Domů</Link>
      <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>Profil</Link>
      <Link to="/shifts" className={`nav-link ${isActive('/shifts') ? 'active' : ''}`}>Služby</Link>
      <NavLink to="/skoleni" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Školení</NavLink>
      <NavLink to="/akce" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Akce</NavLink>
      <NavLink to="/statistiky" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Statistiky</NavLink>
      {isAdminOrVJ && (
        <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>Administrace</Link>
      )}
      <button className="nav-btn" onClick={handleLogout} style={mobile ? { marginTop: 'auto', width: '100%' } : {}}>
        Odhlásit
      </button>
    </>
  );

  return (
    <div className="page-layout">
      <nav className="navbar">
        <div className="container navbar-content">
          {/* Logo */}
          <Link to="/" className="nav-brand" style={{ textDecoration: 'none', zIndex: 101, position: 'relative' }}>
            <span>HASIČKA</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="desktop-nav">
            <NavItems />
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className="btn btn-secondary mobile-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ padding: '0.4rem 0.8rem', minHeight: 'auto', zIndex: 101, position: 'relative' }}
          >
            <span style={{ fontSize: '1.2rem' }}>{isMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-content">
          <NavItems mobile={true} />
        </div>
      </div>

      <div className="main-content" style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
