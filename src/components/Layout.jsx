import React from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../firebase';
import { getEffectiveRoles } from '../utils/roles';

// Navigation Items Component for reuse
const NavItems = ({ mobile = false, isActive, isAdminOrVJ, handleLogout }) => (
  <>
    <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Domů</Link>
    <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>Profil</Link>
    <Link to="/shifts" className={`nav-link ${isActive('/shifts') ? 'active' : ''}`}>Služby</Link>
    <NavLink to="/skoleni" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Školení</NavLink>
    <NavLink to="/akce" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Akce</NavLink>
    <NavLink to="/udrzba" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Údržba</NavLink>
    <NavLink to="/uklid" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Úklid</NavLink>
    <NavLink to="/statistiky" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Statistiky</NavLink>
    <NavLink to="/clenove" className={({ isActive: isLinkActive }) => `nav-link ${isLinkActive ? 'active' : ''}`}>Členové</NavLink>
    {isAdminOrVJ && (
      <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>Administrace</Link>
    )}
    <button className="nav-btn" onClick={handleLogout} style={mobile ? { marginTop: 'auto', width: '100%' } : {}}>
      Odhlásit
    </button>
  </>
);

export default function Layout() {
  const { logout, userData } = useAuth();
  usePushNotifications();

  React.useEffect(() => {
    const reconnect = () => {
      disableNetwork(db).then(() => enableNetwork(db)).catch(() => {});
    };

    // App comes to foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reconnect();
    });

    // Network restored after offline
    window.addEventListener('online', reconnect);

    // Mobile network type change (LTE→WiFi, cell tower switch, etc.)
    if (navigator.connection) {
      navigator.connection.addEventListener('change', reconnect);
    }

    return () => {
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('online', reconnect);
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', reconnect);
      }
    };
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Helper to check active link
  const isActive = (path) => location.pathname === path;

  // Check admin access
  const userRoles = getEffectiveRoles(userData ? (userData.roles || [userData.role || 'Hasič']) : []);
  const isAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'Přístup do Administrace'].includes(r));

  // Close menu when route changes
  React.useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  }

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
            <NavItems isActive={isActive} isAdminOrVJ={isAdminOrVJ} handleLogout={handleLogout} />
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
          <NavItems mobile={true} isActive={isActive} isAdminOrVJ={isAdminOrVJ} handleLogout={handleLogout} />
        </div>
      </div>

      <div className="main-content" style={{ flex: 1 }}>
        <Outlet />
      </div>

      <footer style={{
        textAlign: 'center',
        padding: '1.25rem 1rem',
        fontSize: '0.75rem',
        color: '#aaa',
        borderTop: '1px solid #f0f0f0',
        marginTop: '2rem'
      }}>
        <div>Hasičský informační systém &copy; {new Date().getFullYear()}</div>
        <div style={{ marginTop: '0.2rem', color: '#ccc' }}>Vytvořil Peter Greguš &middot; Všechna práva vyhrazena</div>
      </footer>
    </div>
  );
}
