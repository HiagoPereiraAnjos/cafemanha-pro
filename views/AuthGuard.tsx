import React, { useState } from 'react';
import { UserRole } from '../types';
import { Button } from '../components/Shared';
import { Lock } from 'lucide-react';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

const AuthGuard: React.FC<Props> = ({ role, children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, password }),
      });

      const payload = await response
        .json()
        .catch(() => ({ ok: false, error: 'Resposta invalida do servidor.' }));

      if (response.ok && payload?.ok) {
        setIsAuthenticated(true);
        return;
      }

      setError(payload?.error || 'Senha incorreta.');
    } catch {
      setError('Falha ao validar senha no servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center text-slate-700">
            <Lock size={42} strokeWidth={2.2} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Area Restrita</h2>
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
              disabled={isSubmitting}
            />
          </div>
          {error && <p className="text-rose-600 text-sm font-medium">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting || !password}>
            {isSubmitting ? 'Validando...' : 'Acessar Sistema'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AuthGuard;
