import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseService } from '../services/supabaseService';
import { Guest } from '../types';
import { Alert, Button } from '../components/Shared';
import { ShieldCheck, QrCode, Camera, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const extractTokenFromQr = (decodedText: string) => {
  try {
    const url = new URL(decodedText, window.location.origin);
    let tk = url.searchParams.get('token');

    if (!tk) {
      const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const queryIndex = hash.indexOf('?');
      if (queryIndex >= 0) {
        const params = new URLSearchParams(hash.slice(queryIndex + 1));
        tk = params.get('token');
      }
    }

    return tk?.trim() || null;
  } catch {
    return null;
  }
};

const Validate: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingScannerRef = useRef(false);
  const isConfirmingRequestRef = useRef(false);

  const stopScanner = React.useCallback(async () => {
    if (isStoppingScannerRef.current) return;

    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }

    isStoppingScannerRef.current = true;
    try {
      await scanner.stop();
    } catch (error: any) {
      const message = String(error?.message || error || '').toLowerCase();
      const isAlreadyStopped =
        message.includes('not running') ||
        message.includes('not started') ||
        message.includes('paused');

      if (!isAlreadyStopped) {
        console.error(error);
      }
    } finally {
      scannerRef.current = null;
      isStoppingScannerRef.current = false;
      setIsScanning(false);
    }
  }, []);

  const startScanner = async () => {
    if (isScanning) return;

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
            const extractedToken = extractTokenFromQr(decodedText);
            if (extractedToken) {
              setSearchParams({ token: extractedToken });
              void stopScanner();
            }
          },
          () => {}
        )
        .catch((err) => {
          console.error(err);
          setError('Nao foi possivel acessar a camera.');
          scannerRef.current = null;
          setIsScanning(false);
        });
    }, 100);
  };

  useEffect(() => {
    if (!token) {
      setGuest(null);
      setError('');
      setSuccess(false);
      setLoading(false);
      return;
    }

    setError('');
    setSuccess(false);
    setGuest(null);
    setLoading(false);

    return () => {
      void stopScanner();
    };
  }, [token, stopScanner]);

  const confirmConsumption = async () => {
    if (isConfirmingRequestRef.current) return;

    if (!token) {
      setError('Token do QR nao encontrado.');
      return;
    }

    isConfirmingRequestRef.current = true;
    setIsConfirming(true);
    setError('');

    try {
      const consumeResult = await supabaseService.consumeQrToken(token, true);
      if (!consumeResult.ok) {
        setError(consumeResult.error || 'Falha ao validar consumo.');
        return;
      }

      setGuest(consumeResult.data || null);
      setSuccess(true);
    } finally {
      isConfirmingRequestRef.current = false;
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
        <h1 className="text-2xl font-bold text-slate-800">Validador de Cafe</h1>
        <p className="text-slate-500">Aponte a camera ou use o link do QR Code</p>
      </header>

      {!token && !isScanning && (
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <QrCode size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Aguardando Leitura</h2>
            <p className="text-slate-500">
              Use a camera do celular ou o leitor integrado abaixo para validar um hospede.
            </p>
          </div>
          <Button onClick={startScanner} className="w-full py-4 flex items-center justify-center gap-2">
            <Camera size={20} /> Abrir Camera do Sistema
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
          <h2 className="text-xl font-bold text-slate-800">Erro na Validacao</h2>
          <p className="text-slate-500 mt-2 mb-6">{error}</p>
          <Button className="w-full" onClick={handleReset}>
            Tentar Novamente
          </Button>
        </div>
      ) : null}

      {token && !error && !success && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6">
          <div className="p-6 text-center bg-blue-600 text-white">
            <div className="text-4xl mb-2">QR</div>
            <h2 className="text-xl font-bold">QR recebido</h2>
            <p className="text-blue-100 text-sm mt-1">Clique para confirmar consumo no backend.</p>
          </div>

          <div className="p-8 space-y-3">
            <Button
              className="w-full py-4 text-lg shadow-emerald-100"
              variant="success"
              onClick={confirmConsumption}
              disabled={isConfirming}
            >
              {isConfirming ? 'Validando...' : 'Confirmar Cafe da Manha'}
            </Button>
            <Button className="w-full" variant="secondary" onClick={handleReset}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6">
          <div className="p-6 text-center bg-emerald-600 text-white transition-colors duration-500">
            <div className="text-4xl mb-2">OK</div>
            <h2 className="text-xl font-bold">Consumo Registrado</h2>
          </div>

          <div className="p-8 space-y-4">
            {guest && (
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Hospede</div>
                  <div className="font-bold text-slate-800 truncate">{guest.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Quarto</div>
                  <div className="font-bold text-slate-800">{guest.room}</div>
                </div>
              </div>
            )}

            <Alert type="success" message="Registro enviado ao Supabase com sucesso." />
            <Button className="w-full" variant="primary" onClick={handleReset}>
              Proxima Leitura
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Validate;
