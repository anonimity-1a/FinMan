import { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router';
import { api } from './api';
import Icon from './components/Icon';
import AddEntry from './pages/AddEntry';
import Categories from './pages/Categories';
import Dashboard from './pages/Dashboard';
import EditEntry from './pages/EditEntry';
import History from './pages/History';
import Login from './pages/Login';
import AccountPage from './pages/Account';
import { CurrencyProvider } from './currency';
import type { Account } from './types';

export default function App() {
  // undefined while checking the session cookie, null when signed out
  const [user, setUser] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    api.me().then((m) => setUser(m), () => setUser(null));
    const out = () => setUser(null);
    window.addEventListener('finman:signed-out', out);
    return () => window.removeEventListener('finman:signed-out', out);
  }, []);

  if (user === undefined) return <div className="boot" role="status" aria-label="Loading" />;
  if (user === null) return <Login onSignedIn={setUser} />;

  return (
    <BrowserRouter>
      <CurrencyProvider code={user.currency || 'INR'}>
      <div className="shell">
        <aside className="rail">
          <Link to="/" className="brand" aria-label="FinMan home">
            <span className="brand-mark" aria-hidden="true">₹</span>
            <span className="brand-name">FinMan</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end><Icon name="dashboard" /><span>Dashboard</span></NavLink>
            <NavLink to="/history"><Icon name="receipt" /><span>Transactions</span></NavLink>
            <NavLink to="/categories"><Icon name="tag" /><span>Categories</span></NavLink>
            <NavLink to="/account"><Icon name="user" /><span>Account</span></NavLink>
          </nav>
          <NavLink to="/add" className="rail-cta"><Icon name="plus" size={16} /> New entry</NavLink>
          <div className="rail-user">
            <Link to="/account" title={user.username}><span>{user.displayName || user.username}</span></Link>
            <button className="icon-btn" aria-label="Sign out" title="Sign out"
              onClick={() => api.logout().finally(() => setUser(null))}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        </aside>
        <main className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/add" element={<AddEntry />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id/edit" element={<EditEntry />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/account" element={<AccountPage user={user} onUpdated={setUser} />} />
              <Route path="*" element={<div className="empty"><strong>Page not found</strong><Link to="/">Back to dashboard</Link></div>} />
            </Routes>
          </div>
        </main>
      </div>
      </CurrencyProvider>
    </BrowserRouter>
  );
}
