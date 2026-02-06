
import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Guest } from '../types';
import { Alert, Button } from '../components/Shared';
import { Coffee, Search, User as UserIcon, MapPin, ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';

const GuestView: React.FC = () => {
  const [room, setRoom] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [step, setStep] = useState(1);

  const encodeToken = (data: any) => {
    // encodeURIComponent + btoa é a forma segura de lidar com UTF-8 no Base64
    return btoa(encodeURIComponent(JSON.stringify(data)));
  };

  const resolveBaseUrl = () => {
    const envBase = (import.meta as any).env?.VITE_PUBLIC_BASE_URL as string | undefined;
    if (envBase && envBase.trim().length > 0) {
      return envBase.trim();
    }
    return window.location.href;
  };

  const generateValidationUrl = (g: Guest) => {
    const tokenData = { id: g.id, t: Date.now(), h: g.room };
    const token = encodeToken(tokenData);
    const baseUrl = resolveBaseUrl();
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      url = new URL(baseUrl, window.location.origin);
    }
    url.search = '';
    url.hash = `/validar?id=${g.id}&token=${token}`;
    return url.toString();
  };

  const handleIdentifyGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const all = storageService.getGuests();
    const today = new Date().toISOString().split('T')[0];

    const found = all.find(g => 
      g.room.trim() === room.trim() && 
      g.name.trim().toLowerCase() === fullName.trim().toLowerCase()
    );

    if (!found) {
      alert('Hóspede não encontrado. Verifique se o número do quarto e o nome completo estão corretos conforme o registro na recepção.');
      return;
    }

    if (!found.hasBreakfast) {
      alert('Este registro não possui direito ao café da manhã incluso na tarifa.');
      return;
    }

    const alreadyUsed = found.usedToday && found.consumptionDate === today;
    if (alreadyUsed) {
      alert('O café da manhã para este hóspede já foi registrado hoje.');
      return;
    }

    const url = generateValidationUrl(found);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setSelectedGuest(found);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar QR Code. Tente novamente.');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <header className="text-center">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200">
          <Coffee size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Café da Manhã</h1>
        <p className="text-slate-500">Identifique-se para gerar seu acesso</p>
      </header>

      {step === 1 && (
        <form onSubmit={handleIdentifyGuest} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in slide-in-from-bottom-4 space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Número do Apartamento</label>
            <div className="relative">
              <input
                type="text"
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Ex: 101"
                className="w-full pl-12 pr-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:outline-none transition-all text-lg font-bold text-slate-700"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Como registrado no check-in"
                className="w-full pl-12 pr-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:outline-none transition-all text-lg font-bold text-slate-700"
              />
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>
          </div>

          <Alert type="info" message="Dica: O nome deve ser exatamente igual ao que consta na sua reserva." />

          <Button type="submit" className="w-full py-4 text-lg shadow-blue-200">
            Gerar Acesso
          </Button>
        </form>
      )}

      {step === 3 && selectedGuest && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-in zoom-in duration-300">
          <div className="text-emerald-500 mb-4 flex justify-center">
            <CheckCircle2 size={56} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Acesso Pronto!</h2>
          <p className="text-slate-500 mt-2">Olá, <span className="font-bold text-slate-800">{selectedGuest.name}</span>.<br/>Apresente o código abaixo no restaurante.</p>
          
          <div className="my-8 p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center">
             <div className="bg-white p-4 rounded-2xl shadow-sm overflow-hidden">
                <img src={qrCodeDataUrl} alt="QR Code de Acesso" className="w-56 h-56 object-contain" />
             </div>
             <div className="mt-4 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Válido para</span>
                <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">QUARTO {selectedGuest.room}</span>
             </div>
          </div>

          <Alert type="warning" message="Este código expira ao final do horário do café de hoje." />
          
          <div className="space-y-3">
            <Button 
              className="w-full py-4 text-lg" 
              variant="primary"
              onClick={() => window.open(generateValidationUrl(selectedGuest), '_blank')}
            >
              Simular Leitura (Validar)
            </Button>
            
            <button 
              onClick={() => { setStep(1); setSelectedGuest(null); }}
              className="flex items-center justify-center gap-2 w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors"
            >
              <ArrowLeft size={16} /> Corrigir dados
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircle2: React.FC<{ className?: string; size?: number }> = ({ className, size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
);

export default GuestView;
