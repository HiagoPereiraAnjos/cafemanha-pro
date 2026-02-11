import React, { useEffect, useState } from 'react';
import { UserRole } from '../types';
import { Button } from '../components/Shared';
import { Lock } from 'lucide-react';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

const AuthGuard: React.FC<Props> = ({ role, children }) => {
  const [authStatus, setAuthStatus] = useState<
    'checking' | 'authenticated' | 'unauthenticated'
  >('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      setAuthStatus('checking');
      setError('');

      try {
        const response = await fetch('/api/me');
        const payload = await response
          .json()
          .catch(() => ({ authenticated: false }));

        if (!mounted) return;

        if (!response.ok) {
          setAuthStatus('unauthenticated');
          return;
        }

        if (payload?.authenticated && payload?.role === role) {
          setAuthStatus('authenticated');
          return;
        }

        if (payload?.authenticated && payload?.role && payload.role !== role) {
          setError('Sessao ativa em outro perfil. Informe a senha deste modulo.');
        }

        setAuthStatus('unauthenticated');
      } catch {
        if (!mounted) return;
        setAuthStatus('unauthenticated');
      }
    };

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [role]);

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
        setAuthStatus('authenticated');
        return;
      }

      setError(payload?.error || 'Senha incorreta.');
    } catch {
      setError('Falha ao validar senha no servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authStatus === 'authenticated') return <>{children}</>;

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

        {authStatus === 'checking' ? (
          <div className="py-4 text-center text-slate-500 font-medium">
            Verificando sessao...
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default AuthGuard;
