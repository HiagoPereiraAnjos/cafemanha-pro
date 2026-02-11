import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import QRCodeLib from 'qrcode';
import { Search, Coffee, QrCode, ArrowLeft, MapPin, User } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { PublicGuest } from '../types';
import { Alert, Button } from '../components/Shared';
import { getBaseUrl } from '../utils/url';

type Feedback = {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

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

const GuestView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const roomFromLegacyUrl = getRoomFromParams(searchParams);

  const [room, setRoom] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<PublicGuest | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isUsedToday = (guest: PublicGuest) => guest.usedToday;

  const clearResult = () => {
    setSelectedGuest(null);
    setQrCodeDataUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearResult();

    const roomValue = room.trim();
    const nameValue = fullName.trim();

    if (!roomValue || !nameValue) {
      setFeedback({
        type: 'warning',
        message: 'Informe o quarto e o nome completo.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await supabaseService.findGuestByRoomAndName(
        roomValue,
        nameValue
      );

      if (!result.ok) {
        setFeedback({
          type: 'error',
          message: `Falha ao consultar hospede no Supabase: ${result.error}`,
        });
        return;
      }

      const guest = result.data;
      if (!guest) {
        setFeedback({
          type: 'warning',
          message:
            'Hospede nao encontrado para este quarto. Confira o nome e tente novamente.',
        });
        return;
      }

      if (!guest.hasBreakfast) {
        setSelectedGuest(guest);
        setFeedback({
          type: 'warning',
          message: `${guest.name} nao possui direito ao cafe da manha.`,
        });
        return;
      }

      if (isUsedToday(guest)) {
        setSelectedGuest(guest);
        setFeedback({
          type: 'warning',
          message: `O cafe da manha de ${guest.name} ja foi utilizado hoje.`,
        });
        return;
      }

      const issueTokenResult = await supabaseService.issueQrToken(guest.id);
      if (!issueTokenResult.ok || !issueTokenResult.data?.token) {
        setFeedback({
          type: 'error',
          message: `Falha ao emitir token seguro do QR: ${issueTokenResult.error || 'token ausente.'}`,
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
      setFeedback({
        type: 'success',
        message: 'QR Code gerado com sucesso.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erro ao gerar QR Code.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Backward compatibility for old room QR links.
  if (roomFromLegacyUrl) {
    return (
      <Navigate
        to={`/acesso-quarto?room=${encodeURIComponent(roomFromLegacyUrl)}`}
        replace
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <header className="text-center">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200">
          <Coffee size={40} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Area do Hospede</h1>
        <p className="text-slate-500">Informe quarto e nome para gerar seu QR</p>
      </header>

      {feedback && <Alert type={feedback.type} message={feedback.message} />}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-4"
      >
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Quarto
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ex: 101"
              className="w-full pl-12 pr-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:outline-none transition-all text-lg font-bold text-slate-700"
            />
            <MapPin
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              size={20}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Nome Completo
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Digite seu nome"
              className="w-full pl-12 pr-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:outline-none transition-all text-lg font-bold text-slate-700"
            />
            <User
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              size={20}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full py-4 text-lg shadow-blue-200 flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          <Search size={18} />
          {isLoading ? 'Consultando...' : 'Buscar e Gerar QR'}
        </Button>
      </form>

      {selectedGuest && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
          <div className="text-blue-600 mb-4 flex justify-center">
            <QrCode size={52} />
          </div>

          <h2 className="text-2xl font-bold text-slate-800">
            {qrCodeDataUrl ? 'QR Gerado' : 'Resultado da Consulta'}
          </h2>

          <p className="text-slate-500 mt-2">
            Hospede: <span className="font-bold text-slate-800">{selectedGuest.name}</span>
          </p>
          <p className="text-slate-500">
            Quarto: <span className="font-bold text-slate-800">{room.trim() || '-'}</span>
          </p>

          {qrCodeDataUrl && (
            <>
              <div className="my-8 p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-sm overflow-hidden">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code de Acesso"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              </div>
              <Alert
                type="warning"
                message="Apresente este QR no restaurante para validar seu cafe."
              />
            </>
          )}

          <button
            onClick={clearResult}
            className="flex items-center justify-center gap-2 w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={16} /> Limpar resultado
          </button>
        </div>
      )}
    </div>
  );
};

export default GuestView;
