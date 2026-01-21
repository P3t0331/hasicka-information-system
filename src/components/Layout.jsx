import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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

  return (
    <div className="page-layout">
      <nav className="navbar">
        <div className="container navbar-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>
              <span>HASIČKA</span>
            </Link>
            {/* Mobile Hamburger */}
            <button 
              className="btn btn-secondary mobile-only" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ padding: '0.4rem 0.8rem', minHeight: 'auto' }}
            >
              <span style={{ fontSize: '1.2rem' }}>{isMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>

          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              Profil
            </Link>
            <Link to="/shifts" className={`nav-link ${isActive('/shifts') ? 'active' : ''}`}>
              Služby
            </Link>
            <Link to="/statistiky" className={`nav-link ${isActive('/statistiky') ? 'active' : ''}`}>
              Statistiky
            </Link>
            {isAdminOrVJ && (
              <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                Administrace
              </Link>
            )}
            <button className="nav-btn" onClick={handleLogout}>
              Odhlásit
            </button>
          </div>
        </div>
      </nav>
      
      <div className="main-content" style={{ flex: 1 }}>
        <Outlet />
      </div>
      
      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setIsMenuOpen(false)}
          className="mobile-only"
        />
      )}
    </div>
  );
}
