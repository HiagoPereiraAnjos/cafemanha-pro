import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Utensils,
  QrCode,
  Coffee,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { UserRole } from './types';
import AuthGuard from './views/AuthGuard';
import Reception from './views/Reception';
import Restaurant from './views/Restaurant';
import GuestView from './views/Guest';
import RoomAccess from './views/RoomAccess';
import Validate from './views/Validate';

const Navigation: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/recepcao', label: 'Recepcao', icon: <LayoutDashboard size={18} /> },
    { path: '/restaurante', label: 'Restaurante', icon: <Utensils size={18} /> },
    { path: '/validar', label: 'Validar', icon: <QrCode size={18} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 md:top-0 md:bottom-auto md:px-6 md:pt-5 md:pb-0">
      <div className="max-w-7xl mx-auto rounded-2xl border border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-xl shadow-slate-300/20">
        <div className="flex items-center justify-between px-4 py-3 md:px-5">
          <div className="hidden md:flex items-center gap-2 font-black text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Coffee size={16} />
            </div>
            Breakfast Control
          </div>

          <div className="flex w-full md:w-auto justify-between md:justify-end gap-2 md:gap-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-300/50'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

const Home: React.FC = () => {
  const cards = [
    {
      path: '/recepcao',
      title: 'Recepcao',
      description: 'Importacao da planilha, cadastro manual e sincronizacao com Supabase.',
      icon: <LayoutDashboard size={24} />,
      accent: 'from-blue-600 to-sky-500',
    },
    {
      path: '/restaurante',
      title: 'Restaurante',
      description: 'Acompanhamento da lista de consumo e status em tempo real.',
      icon: <Utensils size={24} />,
      accent: 'from-emerald-600 to-teal-500',
    },
    {
      path: '/validar',
      title: 'Validar',
      description: 'Leitura do QR Code e baixa de uso do cafe da manha.',
      icon: <QrCode size={24} />,
      accent: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="pb-20 md:pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-2xl shadow-slate-300/30 p-6 md:p-10">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black tracking-wide uppercase">
            <ShieldCheck size={14} />
            Hotel Breakfast Control Pro
          </span>

          <h1 className="mt-4 text-3xl md:text-5xl font-black text-slate-900 leading-tight">
            Gestao moderna de cafe da manha para hotel
          </h1>

          <p className="mt-4 text-slate-600 max-w-3xl text-sm md:text-base">
            Interface otimizada para recepcao e restaurante, com validacao por QR Code e dados
            centralizados no Supabase.
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.path}
            to={card.path}
            className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-300/20 hover:-translate-y-1 hover:shadow-xl transition-all"
          >
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.accent} text-white flex items-center justify-center shadow-md`}
            >
              {card.icon}
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-800">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600 min-h-[42px]">{card.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-700 group-hover:text-blue-600">
              Acessar
              <ChevronRight size={16} />
            </div>
          </Link>
        ))}
      </section>

    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-blue-50/40">
        <Navigation />

        <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pb-24 md:pb-8 pt-4 md:pt-28">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/recepcao"
              element={
                <AuthGuard role={UserRole.RECEPTION}>
                  <Reception />
                </AuthGuard>
              }
            />
            <Route
              path="/restaurante"
              element={
                <AuthGuard role={UserRole.RESTAURANT}>
                  <Restaurant />
                </AuthGuard>
              }
            />
            <Route path="/hospede" element={<GuestView />} />
            <Route path="/acesso-quarto" element={<RoomAccess />} />
            <Route
              path="/validar"
              element={
                <AuthGuard role={UserRole.VALIDATOR}>
                  <Validate />
                </AuthGuard>
              }
            />
          </Routes>
        </main>

        <footer className="hidden md:block pb-6 text-center text-slate-400 text-sm">
          &copy; 2025 Hotel Breakfast Control Pro
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
