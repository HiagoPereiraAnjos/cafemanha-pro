
import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Guest, GuestInsertInput, AppStats } from '../types';
import { StatCard, Alert, Button } from '../components/Shared';
import { Users, DoorClosed, Coffee, CheckCircle2, Search, X, Download, FileSpreadsheet, FileText, ChevronDown, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

type ReceptionStatusFilter = 'all' | 'with_breakfast' | 'without_breakfast' | 'used_today';
const POLL_BASE_DELAY_MS = 5000;
const POLL_MAX_DELAY_MS = 30000;

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const Reception: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [importData, setImportData] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewList, setPreviewList] = useState<GuestInsertInput[]>([]);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualTariff, setManualTariff] = useState('');
  const [manualPlan, setManualPlan] = useState('');
  const [manualHasBreakfast, setManualHasBreakfast] = useState(true);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReceptionStatusFilter>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [stats, setStats] = useState<AppStats>({
    totalGuests: 0,
    totalRooms: 0,
    withBreakfast: 0,
    usedTodayCount: 0
  });

  const loadData = async (): Promise<boolean> => {
    const result = await supabaseService.getGuests();
    if (!result.ok) {
      setSyncError(`Falha na sincronização com Supabase: ${result.error}`);
      return false;
    }

    const data = result.data || [];
    setGuests(data);
    setSyncError(null);
    setLastSyncAt(new Date().toLocaleTimeString('pt-BR'));

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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const handleImport = () => {
    if (!importData.trim()) return;
    const lines = importData.trim().split('\n');
    
    const parsed = lines.map(line => {
      const cols = line.split('\t');
      if (cols.length < 5) return null;
      
      const room = cols[1]?.split(' ')[0] || '???';
      const name = cols[2] || 'Hóspede';
      const company = cols[3] || 'Particular';
      const checkIn = cols[4] || '';
      const checkOut = cols[5] || '';
      const tariff = cols[7] || '';
      const plan = cols[8] || '';
      const hasBreakfast = plan.includes('Café da Manhã') || tariff.includes('COM Café');

      return {
        name, room, company, checkIn, checkOut, tariff, plan,
        hasBreakfast, consumptionDate: null
      };
    }).filter((x): x is GuestInsertInput => x !== null);

    if (parsed.length === 0) {
      alert('Nenhum dado válido encontrado para importar. Certifique-se de copiar as colunas do Excel.');
      return;
    }

    setPreviewList(parsed);
    setShowPreview(true);
  };

  const confirmImport = async () => {
    setIsSavingImport(true);
    try {
      const replaceResult = await supabaseService.replaceGuests(previewList);
      if (!replaceResult.ok) {
        alert(`Falha ao substituir dados no Supabase: ${replaceResult.error}`);
        return;
      }

      setImportData('');
      setShowPreview(false);
      await loadData();
      alert('Dados substituídos com sucesso no Supabase!');
    } finally {
      setIsSavingImport(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = manualName.trim();
    const room = manualRoom.trim();
    if (!name || !room) {
      alert('Informe pelo menos nome e quarto.');
      return;
    }

    setIsSavingManual(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const guest: GuestInsertInput = {
        name,
        room,
        company: manualCompany.trim() || 'Particular',
        checkIn: manualCheckIn || today,
        checkOut: manualCheckOut || '',
        tariff: manualTariff.trim(),
        plan: manualPlan.trim(),
        hasBreakfast: manualHasBreakfast,
        consumptionDate: null,
      };

      const insertResult = await supabaseService.insertGuests([guest]);
      if (!insertResult.ok) {
        alert(`Falha ao cadastrar hóspede: ${insertResult.error}`);
        return;
      }

      setManualName('');
      setManualRoom('');
      setManualCompany('');
      setManualCheckIn('');
      setManualCheckOut('');
      setManualTariff('');
      setManualPlan('');
      setManualHasBreakfast(true);
      await loadData();
      alert('Hóspede cadastrado com sucesso!');
    } finally {
      setIsSavingManual(false);
    }
  };

  const filteredGuests = useMemo(() => {
    const term = normalizeSearchText(debouncedSearch);
    const terms = term.length > 0 ? term.split(' ').filter(Boolean) : [];
    const byRoomAsc = (a: Guest, b: Guest) =>
      a.room.localeCompare(b.room, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

    return guests
      .filter((g) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'with_breakfast' && g.hasBreakfast) ||
          (statusFilter === 'without_breakfast' && !g.hasBreakfast) ||
          (statusFilter === 'used_today' && g.usedToday);

        if (!matchesStatus) return false;
        if (terms.length === 0) return true;

        const combined = normalizeSearchText(`${g.name} ${g.room}`);
        return terms.every((searchTerm) => combined.includes(searchTerm));
      })
      .sort(byRoomAsc);
  }, [guests, debouncedSearch, statusFilter]);

  const exportToExcel = () => {
    if (filteredGuests.length === 0) return;
    const consumedCount = filteredGuests.filter((g) => g.usedToday).length;

    const data = filteredGuests.map(g => ({
      'Nome do HÃ³spede': g.name,
      'Quarto': g.room,
      'Empresa': g.company,
      'Direito ao CafÃ©': g.hasBreakfast ? 'Sim' : 'NÃ£o',
      'Consumido Hoje': g.usedToday ? 'Sim' : 'NÃ£o',
      'Data do Consumo': g.consumptionDate || '-',
      'Check-out': g.checkOut
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Resumo do Relatorio'],
      ['Total de registros', filteredGuests.length],
      ['Ja utilizaram cafe', consumedCount],
      ['Ainda nao utilizaram cafe', filteredGuests.length - consumedCount],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
    XLSX.utils.book_append_sheet(workbook, worksheet, "HÃ³spedes");

    const maxWidths = Object.keys(data[0] || {}).map(key => ({ wch: key.length + 5 }));
    worksheet['!cols'] = maxWidths;
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 24 }];

    XLSX.writeFile(workbook, `hotel_hospedes_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportMenuOpen(false);
  };
  const exportToPDF = () => {
    if (filteredGuests.length === 0) return;
    const consumedCount = filteredGuests.filter((g) => g.usedToday).length;

    const doc = new jsPDF();
    const today = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('RelatÃ³rio de HÃ³spedes - CafÃ© da ManhÃ£', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${today}`, 14, 28);
    doc.text(`Total de registros: ${filteredGuests.length}`, 14, 33);
    doc.text(`Ja utilizaram cafe: ${consumedCount}`, 14, 38);

    const tableData = filteredGuests.map(g => [
      g.name,
      g.room,
      g.hasBreakfast ? 'Sim' : 'NÃ£o',
      g.usedToday ? 'Sim' : 'NÃ£o',
      g.checkOut
    ]);

    (doc as any).autoTable({
      head: [['Nome', 'Quarto', 'Direito CafÃ©', 'Consumido', 'Check-out']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
      styles: { fontSize: 9 },
    });

    doc.save(`hotel_hospedes_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportMenuOpen(false);
  };
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Painel da Recepção</h1>
          <p className="text-slate-500">Gestão de hóspedes e direitos ao café da manhã</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm('Deseja realmente limpar todos os dados?')) return;
              const resetResult = await supabaseService.resetGuests();
              if (!resetResult.ok) {
                alert(`Falha ao limpar dados no Supabase: ${resetResult.error}`);
                return;
              }
              await loadData();
            }}
          >
            Limpar Tudo
          </Button>
          <Button
            variant="success"
            onClick={() => {
              void loadData();
            }}
          >
            Atualizar
          </Button>
        </div>
      </header>

      {syncError && <Alert type="error" message={syncError} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Hóspedes" value={stats.totalGuests} icon={<Users />} />
        <StatCard label="Quartos Ocupados" value={stats.totalRooms} icon={<DoorClosed />} />
        <StatCard label="Direito a Café" value={stats.withBreakfast} icon={<Coffee />} />
        <StatCard label="Utilizados Hoje" value={stats.usedTodayCount} icon={<CheckCircle2 />} />
      </div>

      {/* Área de Importação Restaurada */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          📥 Importar Planilha
        </h2>
        <Alert type="info" message="Copie os dados da planilha do hotel e cole abaixo. O sistema identificará automaticamente o quarto, nome e direito ao café." />
        <textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          placeholder="Cole aqui os dados da planilha (Quarto, Hóspede, Empresa, etc)..."
          className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4 font-mono text-sm"
        />
        <Button variant="primary" onClick={handleImport}>Processar Dados para Importação</Button>

        {showPreview && (
          <div className="mt-8 border-t pt-6 animate-in slide-in-from-top-4">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              📋 Conferência ({previewList.length} registros)
            </h3>
            <div className="max-h-60 overflow-y-auto mb-4 border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-3 text-left">Quarto</th>
                    <th className="p-3 text-left">Hóspede</th>
                    <th className="p-3 text-left">Direito Café</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewList.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{p.room}</td>
                      <td className="p-3">{p.name}</td>
                      <td className="p-3">
                        {p.hasBreakfast ? (
                          <span className="text-emerald-600 font-bold">Sim</span>
                        ) : (
                          <span className="text-rose-600 font-bold">Não</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button
                variant="success"
                onClick={confirmImport}
                className="flex-1"
                disabled={isSavingImport}
              >
                {isSavingImport ? 'Salvando...' : 'Confirmar e Salvar no Sistema'}
              </Button>
              <Button variant="secondary" onClick={() => setShowPreview(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus size={20} /> Cadastro Manual
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Use este formulario para incluir um hospede que nao veio na planilha.
        </p>

        <form onSubmit={handleManualAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nome do hospede *"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Quarto *"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualRoom}
              onChange={(e) => setManualRoom(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Empresa"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
            />
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualCheckIn}
              onChange={(e) => setManualCheckIn(e.target.value)}
            />
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualCheckOut}
              onChange={(e) => setManualCheckOut(e.target.value)}
            />
            <input
              type="text"
              placeholder="Tarifa"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualTariff}
              onChange={(e) => setManualTariff(e.target.value)}
            />
            <input
              type="text"
              placeholder="Plano"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
              value={manualPlan}
              onChange={(e) => setManualPlan(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={manualHasBreakfast}
              onChange={(e) => setManualHasBreakfast(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Possui direito ao cafe da manha
          </label>

          <div className="flex justify-end">
            <Button type="submit" variant="success" disabled={isSavingManual}>
              {isSavingManual ? 'Salvando...' : 'Adicionar Hospede'}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Lista de Hóspedes</h2>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
               <div
                 className={`w-2 h-2 rounded-full ${syncError ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}
               ></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {syncError ? 'Falha de sincronizacao' : 'Sincronizado'}
                 {lastSyncAt ? ` - ${lastSyncAt}` : ''}
               </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReceptionStatusFilter)}
              className="w-full sm:w-56 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
            >
              <option value="all">Todos os status</option>
              <option value="with_breakfast">Com cafe</option>
              <option value="without_breakfast">Sem cafe</option>
              <option value="used_today">Ja consumiu</option>
            </select>

            <div className="relative group w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar por nome + quarto..."
                className="w-full pl-11 pr-12 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all shadow-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && <button onClick={() => setSearchInput('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"><X size={18} /></button>}
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-2xl transition-all w-full lg:w-auto"
              >
                <Download size={18} /> Exportar <ChevronDown size={16} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in duration-200">
                  <button onClick={exportToExcel} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"><FileSpreadsheet size={18} className="text-emerald-600" /> Planilha Excel</button>
                  <button onClick={exportToPDF} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"><FileText size={18} className="text-rose-600" /> Documento PDF</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left">Hóspede</th>
                <th className="p-4 text-left">Quarto</th>
                <th className="p-4 text-left">Direito Café</th>
                <th className="p-4 text-left">Status Hoje</th>
                <th className="p-4 text-left">Check-out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGuests.map((g) => (
                <tr key={g.id} className={`hover:bg-blue-50/30 transition-all duration-500 group ${g.usedToday ? 'bg-amber-50/20' : ''}`}>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{g.name}</div>
                    <div className="text-xs text-slate-400">{g.company}</div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{g.room}</td>
                  <td className="p-4">
                    {g.hasBreakfast ? (
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black tracking-tight">COM DIREITO</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black tracking-tight">SEM DIREITO</span>
                    )}
                  </td>
                  <td className="p-4">
                    {g.usedToday ? (
                      <span className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black tracking-tight flex items-center gap-1 w-fit shadow-lg shadow-amber-200 animate-in zoom-in">
                        <CheckCircle2 size={12} /> UTILIZADO
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black tracking-tight">DISPONÍVEL</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500 text-sm font-medium">{g.checkOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredGuests.length === 0 && (
            <div className="p-16 text-center text-slate-400">Nenhum hóspede encontrado para os critérios de busca.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reception;
