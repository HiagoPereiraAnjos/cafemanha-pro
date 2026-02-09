
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserRole } from './types';
import AuthGuard from './views/AuthGuard';
import Reception from './views/Reception';
import Restaurant from './views/Restaurant';
import GuestView from './views/Guest';
import Validate from './views/Validate';
import { LayoutDashboard, Utensils, User, QrCode } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/recepcao', label: 'Recepção', icon: <LayoutDashboard size={20} /> },
    { path: '/restaurante', label: 'Restaurante', icon: <Utensils size={20} /> },
    { path: '/hospede', label: 'Hóspede', icon: <User size={20} /> },
    { path: '/validar', label: 'Validar', icon: <QrCode size={20} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 z-40 px-6 py-3 md:top-0 md:bottom-auto md:border-b md:border-t-0">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="hidden md:flex items-center gap-2 font-bold text-blue-600 text-lg">
           <span className="text-2xl">☕</span> Hotel Breakfast Control
        </div>
        <div className="flex w-full md:w-auto justify-around md:justify-end gap-1 md:gap-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1.5 rounded-xl transition-all ${
                isActive(item.path) 
                  ? 'text-blue-600 bg-blue-50 md:bg-blue-600 md:text-white font-bold' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              <span className="text-[10px] md:text-sm font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navigation />
        <main className="flex-1 p-4 md:pt-24 md:px-8 max-w-7xl mx-auto w-full mb-20 md:mb-0">
          <Routes>
            <Route path="/" element={
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 pt-20">
                <div className="text-6xl">🏨</div>
                <h1 className="text-4xl font-black text-slate-800">Bem-vindo ao Breakfast Control</h1>
                <p className="text-slate-500 max-w-md">Escolha um dos acessos acima para iniciar o gerenciamento de café da manhã.</p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                  <Link to="/recepcao" className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all font-bold text-slate-700">Recepção</Link>
                  <Link to="/restaurante" className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all font-bold text-slate-700">Restaurante</Link>
                  <Link to="/hospede" className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all font-bold text-slate-700">Hóspede</Link>
                  <Link to="/validar" className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all font-bold text-slate-700">Validar</Link>
                </div>
              </div>
            } />
            <Route path="/recepcao" element={<AuthGuard role={UserRole.RECEPTION}><Reception /></AuthGuard>} />
            {/* Fixed: UserRole key was RESTAURANTE (value), should be RESTAURANT (key) */}
            <Route path="/restaurante" element={<AuthGuard role={UserRole.RESTAURANT}><Restaurant /></AuthGuard>} />
            <Route path="/hospede" element={<GuestView />} />
            {/* Fixed: UserRole key was VALIDAR (value), should be VALIDATOR (key) */}
            <Route path="/validar" element={<AuthGuard role={UserRole.VALIDATOR}><Validate /></AuthGuard>} />
          </Routes>
        </main>
        <footer className="hidden md:block py-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-white">
          &copy; 2025 Hotel Breakfast Control Pro - Sistema de Alta Performance
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
