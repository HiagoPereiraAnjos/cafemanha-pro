
import React, { useState, useEffect } from 'react';
import { UserRole, AuthSession } from '../types';
import { PASSWORDS, AUTH_EXPIRY_MS } from '../constants';
import { Button } from '../components/Shared';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

const AuthGuard: React.FC<Props> = ({ role, children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const storageKey = `auth_session_${role}`;

  useEffect(() => {
    const sessionStr = sessionStorage.getItem(storageKey);
    if (sessionStr) {
      const session: AuthSession = JSON.parse(sessionStr);
      if (Date.now() - session.timestamp < AUTH_EXPIRY_MS) {
        setIsAuthenticated(true);
      }
    }
  }, [role, storageKey]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORDS[role as keyof typeof PASSWORDS]) {
      const session: AuthSession = {
        role,
        timestamp: Date.now(),
        authenticated: true
      };
      sessionStorage.setItem(storageKey, JSON.stringify(session));
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Senha incorreta.');
    }
  };

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800">Área Restrita</h2>
          <p className="text-slate-500 mt-2">Acesso apenas para equipe {role.toLowerCase()}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              autoFocus
            />
          </div>
          {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
          <Button type="submit" className="w-full">Acessar Sistema</Button>
        </form>
      </div>
    </div>
  );
};

export default AuthGuard;
