
import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Guest, AppStats } from '../types';
import { StatCard, Alert, Button } from '../components/Shared';
import { Users, DoorClosed, Coffee, CheckCircle2, Search, X, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const SUPABASE_QUERY_ENABLED_KEY = 'reception_can_query_supabase';

const Reception: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [importData, setImportData] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewList, setPreviewList] = useState<Omit<Guest, 'id' | 'createdAt'>[]>([]);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [canQuerySupabase, setCanQuerySupabase] = useState(
    () => localStorage.getItem(SUPABASE_QUERY_ENABLED_KEY) === '1'
  );
  const [filter, setFilter] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [stats, setStats] = useState<AppStats>({
    totalGuests: 0,
    totalRooms: 0,
    withBreakfast: 0,
    usedTodayCount: 0
  });

  const loadData = async (force = false) => {
    if (!canQuerySupabase && !force) return;

    const result = await supabaseService.getGuests();
    if (!result.ok) {
      alert(`Erro ao carregar hóspedes do Supabase: ${result.error}`);
      return;
    }

    const data = result.data || [];
    setGuests(data);

    const uniqueRooms = new Set(data.map((g) => g.room));
    const today = new Date().toISOString().split('T')[0];

    setStats({
      totalGuests: data.length,
      totalRooms: uniqueRooms.size,
      withBreakfast: data.filter((g) => g.hasBreakfast).length,
      usedTodayCount: data.filter(
        (g) => g.usedToday && g.consumptionDate === today
      ).length,
    });
  };

  useEffect(() => {
    if (!canQuerySupabase) return;

    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [canQuerySupabase]);

  const handleImport = () => {
    if (!importData.trim()) return;
    const lines = importData.trim().split('\n');
    const today = new Date().toISOString().split('T')[0];
    
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
        hasBreakfast, usedToday: false, consumptionDate: today
      };
    }).filter((x): x is Omit<Guest, 'id' | 'createdAt'> => x !== null);

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
      const resetResult = await supabaseService.resetGuests();
      if (!resetResult.ok) {
        alert(`Falha ao substituir dados no Supabase (etapa limpar): ${resetResult.error}`);
        return;
      }

      const insertResult = await supabaseService.insertGuests(previewList);
      if (!insertResult.ok) {
        alert(`Falha ao substituir dados no Supabase (etapa inserir): ${insertResult.error}`);
        return;
      }

      localStorage.setItem(SUPABASE_QUERY_ENABLED_KEY, '1');
      setCanQuerySupabase(true);
      setImportData('');
      setShowPreview(false);
      await loadData(true);
      alert('Dados substituídos com sucesso no Supabase!');
    } finally {
      setIsSavingImport(false);
    }
  };

  const filteredGuests = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const byRoomAsc = (a: Guest, b: Guest) =>
      a.room.localeCompare(b.room, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

    if (!term) return [...guests].sort(byRoomAsc);

    return guests
      .filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.room.toLowerCase().includes(term)
      )
      .sort(byRoomAsc);
  }, [guests, filter]);

  const exportToExcel = () => {
    if (filteredGuests.length === 0) return;
    
    const data = filteredGuests.map(g => ({
      'Nome do Hóspede': g.name,
      'Quarto': g.room,
      'Empresa': g.company,
      'Direito ao Café': g.hasBreakfast ? 'Sim' : 'Não',
      'Consumido Hoje': g.usedToday ? 'Sim' : 'Não',
      'Data do Consumo': g.consumptionDate || '-',
      'Check-out': g.checkOut
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hóspedes");
    
    const maxWidths = Object.keys(data[0] || {}).map(key => ({ wch: key.length + 5 }));
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `hotel_hospedes_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportMenuOpen(false);
  };

  const exportToPDF = () => {
    if (filteredGuests.length === 0) return;

    const doc = new jsPDF();
    const today = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório de Hóspedes - Café da Manhã', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${today}`, 14, 28);
    doc.text(`Total de registros: ${filteredGuests.length}`, 14, 33);

    const tableData = filteredGuests.map(g => [
      g.name,
      g.room,
      g.hasBreakfast ? 'Sim' : 'Não',
      g.usedToday ? 'Sim' : 'Não',
      g.checkOut
    ]);

    (doc as any).autoTable({
      head: [['Nome', 'Quarto', 'Direito Café', 'Consumido', 'Check-out']],
      body: tableData,
      startY: 40,
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
              if (!canQuerySupabase) {
                alert('Importe a planilha primeiro para habilitar consultas no Supabase.');
                return;
              }
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
              if (!canQuerySupabase) {
                alert('Importe a planilha primeiro para habilitar consultas no Supabase.');
                return;
              }
              void loadData();
            }}
          >
            Atualizar
          </Button>
        </div>
      </header>

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
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Lista de Hóspedes</h2>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizado</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto relative">
            <div className="relative group w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar por nome ou quarto..."
                className="w-full pl-11 pr-12 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all shadow-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {filter && <button onClick={() => setFilter('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"><X size={18} /></button>}
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
