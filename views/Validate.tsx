import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Guest } from '../types';
import { Alert, Button } from '../components/Shared';
import { ShieldCheck, QrCode, Camera, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const Validate: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const guestId = searchParams.get('id');
  const token = searchParams.get('token');

  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const alreadyUsedToday = Boolean(
    guest && guest.usedToday && guest.consumptionDate === today
  );

  const extractParamsFromQr = (decodedText: string) => {
    try {
      const url = new URL(decodedText, window.location.origin);
      let id = url.searchParams.get('id');
      let tk = url.searchParams.get('token');

      if (!id || !tk) {
        const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
        const queryIndex = hash.indexOf('?');
        if (queryIndex >= 0) {
          const query = hash.slice(queryIndex + 1);
          const params = new URLSearchParams(query);
          id = id || params.get('id');
          tk = tk || params.get('token');
        }
      }

      if (id && tk) {
        return { id, token: tk };
      }
    } catch {
      // ignore invalid URL
    }
    return null;
  };

  const startScanner = async () => {
    setIsScanning(true);
    setError('');

    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const extracted = extractParamsFromQr(decodedText);
            if (extracted) {
              setSearchParams({ id: extracted.id, token: extracted.token });
              stopScanner();
            }
          },
          () => {}
        )
        .catch((err) => {
          console.error(err);
          setError('Não foi possível acessar a câmera.');
          setIsScanning(false);
        });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          setIsScanning(false);
        })
        .catch((err) => console.error(err));
    } else {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const validateToken = async () => {
      if (!guestId || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setSuccess(false);

      const guestResult = await supabaseService.getGuestById(guestId);
      if (!guestResult.ok) {
        setError(`Falha ao consultar Supabase: ${guestResult.error}`);
        setLoading(false);
        return;
      }

      const found = guestResult.data;
      if (!found) {
        setError('Hóspede não encontrado no sistema.');
        setLoading(false);
        return;
      }

      if (!found.hasBreakfast) {
        setError('Hóspede sem direito ao café da manhã.');
        setLoading(false);
        return;
      }

      setGuest(found);

      try {
        const decodedStr = decodeURIComponent(atob(token));
        const decoded = JSON.parse(decodedStr);

        if (!decoded?.h || decoded.h.trim() !== found.room.trim()) {
          setError('Este código pertence a outro apartamento.');
        }

        const tokenTime = decoded?.t;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (!tokenTime || now - tokenTime > oneDay) {
          setError('Este código expirou. Peça ao hóspede para gerar um novo.');
        }
      } catch {
        setError('QR Code corrompido ou inválido.');
      }

      setLoading(false);
    };

    void validateToken();

    return () => {
      if (scannerRef.current) {
        void scannerRef.current.stop();
      }
    };
  }, [guestId, token, setSearchParams]);

  const confirmConsumption = async () => {
    if (!guest) return;
    if (!guest.hasBreakfast) {
      setError('Hóspede sem direito ao café da manhã.');
      return;
    }

    setIsConfirming(true);
    try {
      const updateResult = await supabaseService.updateGuest(guest.id, {
        usedToday: true,
        consumptionDate: today,
      });

      if (!updateResult.ok) {
        setError(`Falha ao atualizar no Supabase: ${updateResult.error}`);
        return;
      }

      if (updateResult.data) {
        setGuest(updateResult.data);
      }
      setSuccess(true);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setSearchParams({});
    setGuest(null);
    setSuccess(false);
    setError('');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium">Validando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">Validador de Café</h1>
        <p className="text-slate-500">Aponte a câmera ou use o link do QR Code</p>
      </header>

      {!guestId && !isScanning && (
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <QrCode size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Aguardando Leitura</h2>
            <p className="text-slate-500">
              Use a câmera do celular ou o leitor integrado abaixo para validar um hóspede.
            </p>
          </div>
          <Button onClick={startScanner} className="w-full py-4 flex items-center justify-center gap-2">
            <Camera size={20} /> Abrir Câmera do Sistema
          </Button>
        </div>
      )}

      {isScanning && (
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div id="reader" className="w-full rounded-2xl overflow-hidden"></div>
          <Button variant="secondary" onClick={stopScanner} className="w-full mt-4">
            Cancelar Leitura
          </Button>
        </div>
      )}

      {error ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 text-center animate-in zoom-in">
          <div className="text-rose-500 mb-4 flex justify-center">
            <ShieldCheck size={64} className="opacity-20" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Erro na Validação</h2>
          <p className="text-slate-500 mt-2 mb-6">{error}</p>
          <Button className="w-full" onClick={handleReset}>
            Tentar Novamente
          </Button>
        </div>
      ) : guest ? (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6">
          <div
            className={`p-6 text-center ${success ? 'bg-emerald-600' : 'bg-blue-600'} text-white transition-colors duration-500`}
          >
            <div className="text-4xl mb-2">{success ? '✅' : '☕'}</div>
            <h2 className="text-xl font-bold">
              {success ? 'Consumo Registrado!' : 'Dados do Hóspede'}
            </h2>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  Hóspede
                </div>
                <div className="font-bold text-slate-800 truncate">{guest.name}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  Quarto
                </div>
                <div className="font-bold text-slate-800">{guest.room}</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Status de Hoje:</span>
                <span className={`text-sm font-black ${guest.usedToday || success ? 'text-amber-600' : 'text-blue-600'}`}>
                  {success || alreadyUsedToday ? 'JÁ CONSUMIU' : 'DISPONÍVEL'}
                </span>
              </div>
            </div>

            {!success ? (
              <div className="space-y-3">
                <Button
                  className="w-full py-4 text-lg shadow-emerald-100"
                  variant="success"
                  onClick={confirmConsumption}
                  disabled={alreadyUsedToday || isConfirming}
                >
                  {isConfirming ? 'Salvando...' : 'Confirmar Café da Manhã'}
                </Button>
                <Button className="w-full" variant="secondary" onClick={handleReset}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <Alert type="success" message="Registro enviado ao Supabase com sucesso." />
                <Button className="w-full" variant="primary" onClick={handleReset}>
                  Próxima Leitura
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Validate;
