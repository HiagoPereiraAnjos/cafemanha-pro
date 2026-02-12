import React, { useEffect, useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { AppStats } from '../types';
import { StatCard, Alert, Button } from '../components/Shared';
import { Users, DoorClosed, Coffee, CheckCircle2 } from 'lucide-react';

const POLL_BASE_DELAY_MS = 3000;
const POLL_MAX_DELAY_MS = 30000;

const Restaurant: React.FC = () => {
  const [syncError, setSyncError] = useState<string | null>(null);
  const [stats, setStats] = useState<AppStats>({
    totalGuests: 0,
    totalRooms: 0,
    withBreakfast: 0,
    usedTodayCount: 0,
  });

  const loadData = async (): Promise<boolean> => {
    const result = await supabaseService.getGuests();
    if (!result.ok) {
      setSyncError(`Falha na sincronizacao com Supabase: ${result.error}`);
      return false;
    }

    const data = result.data || [];
    setSyncError(null);

    const uniqueRooms = new Set(data.map((g) => g.room));

    setStats({
      totalGuests: data.length,
      totalRooms: uniqueRooms.size,
      withBreakfast: data.filter((g) => g.hasBreakfast).length,
      usedTodayCount: data.filter((g) => g.usedToday).length,
    });
    return true;
  };

  useEffect(() => {
    let disposed = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let nextDelay = POLL_BASE_DELAY_MS;

    const clearScheduled = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const schedule = (delay: number) => {
      if (disposed) return;
      clearScheduled();
      timeoutId = setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (disposed) return;

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule(POLL_BASE_DELAY_MS);
        return;
      }

      const ok = await loadData();
      nextDelay = ok ? POLL_BASE_DELAY_MS : Math.min(POLL_MAX_DELAY_MS, nextDelay * 2);
      schedule(nextDelay);
    };

    const handleVisibilityChange = () => {
      if (disposed) return;
      if (document.visibilityState === 'visible') {
        nextDelay = POLL_BASE_DELAY_MS;
        schedule(0);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    void tick();

    return () => {
      disposed = true;
      clearScheduled();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="text-center md:text-left">
        <h1 className="text-3xl font-bold text-slate-800">Monitor do Restaurante</h1>
        <p className="text-slate-500 mt-2">Acompanhamento em tempo real e lista de acessos</p>
      </header>

      {syncError && <Alert type="error" message={syncError} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ocupacao Total" value={stats.totalGuests} icon={<Users size={24} />} />
        <StatCard label="Quartos na Casa" value={stats.totalRooms} icon={<DoorClosed size={24} />} />
        <StatCard label="Direito ao Cafe" value={stats.withBreakfast} icon={<Coffee size={24} />} />
        <StatCard label="Refeicoes Servidas" value={stats.usedTodayCount} icon={<CheckCircle2 size={24} />} />
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Status Operacional</h2>

        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b">
            <div>
              <div className="font-bold text-slate-800">Progresso do Dia</div>
              <div className="text-sm text-slate-500">Hospedes servidos vs. total com direito</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-600">
                {stats.withBreakfast > 0
                  ? Math.round((stats.usedTodayCount / stats.withBreakfast) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-1000"
              style={{
                width: `${
                  stats.withBreakfast > 0
                    ? (stats.usedTodayCount / stats.withBreakfast) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="primary"
              onClick={() => {
                window.location.hash = '#/validar';
              }}
              className="w-full max-w-xs shadow-blue-100"
            >
              Validar QR Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Restaurant;
