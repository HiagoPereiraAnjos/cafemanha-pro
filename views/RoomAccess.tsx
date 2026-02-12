import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCodeLib from 'qrcode';
import { Coffee, QrCode, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { PublicGuest } from '../types';
import { Alert, Button } from '../components/Shared';
import { getBaseUrl } from '../utils/url';

type Feedback = {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

const POLL_BASE_DELAY_MS = 3000;
const POLL_MAX_DELAY_MS = 30000;

const getRoomFromParams = (searchParams: URLSearchParams) =>
  (
    searchParams.get('room') ||
    searchParams.get('apto') ||
    searchParams.get('quarto') ||
    ''
  ).trim();

const generateValidationUrl = (token: string) => {
  const baseUrl = getBaseUrl();

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    url = new URL(baseUrl, window.location.origin);
  }

  url.search = '';
  url.hash = `/validar?token=${encodeURIComponent(token)}`;
  return url.toString();
};

const RoomAccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const roomFromUrl = getRoomFromParams(searchParams);

  const [roomGuests, setRoomGuests] = useState<PublicGuest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<PublicGuest | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isUsedToday = (guest: PublicGuest) => guest.usedToday;

  useEffect(() => {
    setSelectedGuest(null);
    setQrCodeDataUrl('');
    setFeedback(null);

    if (!roomFromUrl) {
      setRoomGuests([]);
      return;
    }

    void loadGuestsByRoom(roomFromUrl);
  }, [roomFromUrl]);

  useEffect(() => {
    if (!roomFromUrl) return;

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

      const result = await supabaseService.getGuestsByRoom(roomFromUrl);
      if (!result.ok) {
        nextDelay = Math.min(POLL_MAX_DELAY_MS, nextDelay * 2);
        schedule(nextDelay);
        return;
      }

      const guests = result.data || [];
      setRoomGuests(guests);

      nextDelay = POLL_BASE_DELAY_MS;
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

    schedule(POLL_BASE_DELAY_MS);

    return () => {
      disposed = true;
      clearScheduled();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [roomFromUrl]);

  useEffect(() => {
    if (!selectedGuest) return;

    const updatedGuest = roomGuests.find((g) => g.id === selectedGuest.id);
    if (!updatedGuest) return;

    if (
      updatedGuest.id !== selectedGuest.id ||
      updatedGuest.name !== selectedGuest.name ||
      updatedGuest.hasBreakfast !== selectedGuest.hasBreakfast ||
      updatedGuest.usedToday !== selectedGuest.usedToday
    ) {
      setSelectedGuest(updatedGuest);
    }

    if (updatedGuest.usedToday && qrCodeDataUrl) {
      setQrCodeDataUrl('');
      setFeedback({
        type: 'success',
        message: `Leitura confirmada para ${updatedGuest.name}.`,
      });
    }
  }, [roomGuests, selectedGuest, qrCodeDataUrl]);

  const loadGuestsByRoom = async (room: string) => {
    setIsLoading(true);
    const result = await supabaseService.getGuestsByRoom(room);

    if (!result.ok) {
      setRoomGuests([]);
      setFeedback({
        type: 'error',
        message: `Falha ao consultar hospedes do quarto ${room}: ${result.error}`,
      });
      setIsLoading(false);
      return;
    }

    const guests = result.data || [];
    setRoomGuests(guests);

    if (guests.length === 0) {
      setFeedback({
        type: 'warning',
        message: `Nenhum hospede encontrado para o quarto ${room}.`,
      });
    } else {
      setFeedback(null);
    }

    setIsLoading(false);
  };

  const handleSelectGuest = async (guest: PublicGuest) => {
    if (!guest.hasBreakfast) {
      setFeedback({
        type: 'warning',
        message: `${guest.name} nao possui direito ao cafe da manha.`,
      });
      return;
    }

    if (isUsedToday(guest)) {
      setFeedback({
        type: 'warning',
        message: `O cafe da manha de ${guest.name} ja foi utilizado hoje.`,
      });
      return;
    }

    setIsLoading(true);
    try {
      const issueTokenResult = await supabaseService.issueQrToken(guest.id);
      if (!issueTokenResult.ok || !issueTokenResult.data?.token) {
        setFeedback({
          type: 'error',
          message: issueTokenResult.error || 'Nao foi possivel gerar o QR Code agora.',
        });
        return;
      }

      const validationUrl = generateValidationUrl(issueTokenResult.data.token);
      const dataUrl = await QRCodeLib.toDataURL(validationUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      setSelectedGuest(guest);
      setQrCodeDataUrl(dataUrl);
      setFeedback(null);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erro ao gerar QR Code.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <header className="text-center">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200">
          <Coffee size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Cafe da Manha</h1>
        <p className="text-slate-500">Selecione seu nome para gerar seu QR individual</p>
      </header>

      {feedback && <Alert type={feedback.type} message={feedback.message} />}

      {!roomFromUrl && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-4 text-center">
          <Alert
            type="warning"
            message="Link sem quarto informado. Leia o QR Code fixado no quarto."
          />
          <Link
            to="/hospede"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Ir para area do hospede
          </Link>
        </div>
      )}

      {roomFromUrl && !selectedGuest && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-black">
                Quarto
              </p>
              <h2 className="text-3xl font-black text-slate-800">{roomFromUrl}</h2>
            </div>
            <button
              onClick={() => void loadGuestsByRoom(roomFromUrl)}
              disabled={isLoading}
              className="text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Atualizar lista
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              Carregando hospedes...
            </div>
          ) : (
            <div className="space-y-3">
              {roomGuests.map((guest) => {
                const used = isUsedToday(guest);
                return (
                  <div
                    key={guest.id}
                    className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{guest.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {guest.hasBreakfast ? 'Cafe incluido' : 'Sem direito ao cafe'}
                        {used ? ' - Ja utilizado hoje' : ''}
                      </div>
                    </div>

                    <Button
                      variant={guest.hasBreakfast && !used ? 'primary' : 'secondary'}
                      onClick={() => void handleSelectGuest(guest)}
                      disabled={!guest.hasBreakfast || used || isLoading}
                    >
                      {guest.hasBreakfast ? (used ? 'Utilizado' : 'Gerar QR') : 'Sem Direito'}
                    </Button>
                  </div>
                );
              })}

              {roomGuests.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum hospede para este quarto.</p>
              )}
            </div>
          )}
        </div>
      )}

      {selectedGuest && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
          <div className="text-blue-600 mb-4 flex justify-center">
            <QrCode size={52} />
          </div>

          <h2 className="text-2xl font-bold text-slate-800">
            {qrCodeDataUrl ? 'QR Gerado' : 'Consumo Confirmado'}
          </h2>

          <p className="text-slate-500 mt-2">
            Hospede: <span className="font-bold text-slate-800">{selectedGuest.name}</span>
          </p>
          <p className="text-slate-500">
            Quarto: <span className="font-bold text-slate-800">{roomFromUrl || '-'}</span>
          </p>

          {qrCodeDataUrl ? (
            <div className="my-8 p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl shadow-sm overflow-hidden">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code de Acesso"
                  className="w-56 h-56 object-contain"
                />
              </div>
            </div>
          ) : (
            <Alert
              type="success"
              message="Este hospede ja foi validado hoje."
            />
          )}

          {qrCodeDataUrl && (
            <Alert
              type="warning"
              message="Apresente este QR no restaurante para validar seu cafe."
            />
          )}

          <button
            onClick={() => {
              setSelectedGuest(null);
              setQrCodeDataUrl('');
            }}
            className="flex items-center justify-center gap-2 w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={16} /> Voltar para lista
          </button>
        </div>
      )}
    </div>
  );
};

export default RoomAccess;
