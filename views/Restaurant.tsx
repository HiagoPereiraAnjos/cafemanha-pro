
import React, { useState, useEffect, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Guest, AppStats } from '../types';
import { StatCard, Alert, Button } from '../components/Shared';
import { Users, DoorClosed, Coffee, CheckCircle2, Search, X, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const Restaurant: React.FC = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filter, setFilter] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const [stats, setStats] = useState<AppStats>({
    totalGuests: 0,
    totalRooms: 0,
    withBreakfast: 0,
    usedTodayCount: 0
  });

  const loadData = async () => {
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
    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredGuests = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return guests;

    return guests.filter(g => 
      g.name.toLowerCase().includes(term) || 
      g.room.toLowerCase().includes(term)
    );
  }, [guests, filter]);

  const exportToExcel = () => {
    if (filteredGuests.length === 0) return;
    
    const data = filteredGuests.map(g => ({
      'Hóspede': g.name,
      'Apartamento': g.room,
      'Empresa': g.company,
      'Direito Café': g.hasBreakfast ? 'Sim' : 'Não',
      'Consumido': g.usedToday ? 'Sim' : 'Não',
      'Data Hora': g.consumptionDate || '-',
      'Saída Prevista': g.checkOut
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monitor_Restaurante");
    
    XLSX.writeFile(workbook, `restaurante_monitor_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportMenuOpen(false);
  };

  const exportToPDF = () => {
    if (filteredGuests.length === 0) return;

    const doc = new jsPDF();
    const today = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório Diário - Restaurante', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data de Emissão: ${today}`, 14, 28);

    const tableData = filteredGuests.map(g => [
      g.name,
      g.room,
      g.hasBreakfast ? 'Sim' : 'Não',
      g.usedToday ? 'Sim' : 'Não',
      g.checkOut
    ]);

    (doc as any).autoTable({
      head: [['Nome', 'Quarto', 'Direito', 'Status', 'Check-out']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 10 },
      styles: { fontSize: 9 },
    });

    doc.save(`restaurante_monitor_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsExportMenuOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="text-center md:text-left">
        <h1 className="text-3xl font-bold text-slate-800">Monitor do Restaurante</h1>
        <p className="text-slate-500 mt-2">Acompanhamento em tempo real e lista de acessos</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ocupação Total" value={stats.totalGuests} icon={<Users size={24} />} />
        <StatCard label="Quartos na Casa" value={stats.totalRooms} icon={<DoorClosed size={24} />} />
        <StatCard label="Direito ao Café" value={stats.withBreakfast} icon={<Coffee size={24} />} />
        <StatCard label="Refeições Servidas" value={stats.usedTodayCount} icon={<CheckCircle2 size={24} />} />
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          ⚡ Status Operacional
        </h2>
        
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b">
            <div>
              <div className="font-bold text-slate-800">Progresso do Dia</div>
              <div className="text-sm text-slate-500">Hóspedes servidos vs. Total com direito</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-600">
                {stats.withBreakfast > 0 ? Math.round((stats.usedTodayCount / stats.withBreakfast) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-1000"
              style={{ width: `${stats.withBreakfast > 0 ? (stats.usedTodayCount / stats.withBreakfast) * 100 : 0}%` }}
            />
          </div>

          <div className="flex justify-center gap-4">
            <Button variant="primary" onClick={() => window.location.hash = '#/validar'} className="w-full max-w-xs shadow-blue-100">Validar QR Code</Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Checklist de Hóspedes</h2>
            <p className="text-sm text-slate-400 mt-1">
              {filteredGuests.length} hóspedes filtrados
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto relative">
            <div className="relative group w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Nome ou quarto..."
                className="w-full pl-11 pr-12 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all shadow-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {filter && (
                <button onClick={() => setFilter('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                  <X size={18} />
                </button>
              )}
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
                  <button 
                    onClick={exportToExcel}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                  >
                    <FileSpreadsheet size={18} className="text-emerald-600" /> Planilha Excel
                  </button>
                  <button 
                    onClick={exportToPDF}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                  >
                    <FileText size={18} className="text-rose-600" /> Documento PDF
                  </button>
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
                <th className="p-4 text-left">Status Café</th>
                <th className="p-4 text-left">Check-out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGuests.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">{g.name}</div>
                    <div className="text-xs text-slate-400">{g.company}</div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{g.room}</td>
                  <td className="p-4">
                    {g.usedToday ? (
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black tracking-tight flex items-center gap-1 w-fit">
                        <CheckCircle2 size={10} /> JÁ TOMOU
                      </span>
                    ) : g.hasBreakfast ? (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black tracking-tight">PENDENTE</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black tracking-tight uppercase">SEM DIREITO</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500 text-sm font-medium">{g.checkOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Restaurant;
