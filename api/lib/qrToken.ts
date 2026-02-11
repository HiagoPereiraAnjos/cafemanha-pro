import { createHmac, timingSafeEqual } from 'crypto';

type QrTokenPayload = {
  guestId: string;
  timestamp: number;
};

export type QrTokenVerificationResult = QrTokenPayload | 'expired' | null;

const QR_TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 10 * 1000;

const toBase64Url = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
};

const sign = (payloadBase64: string, secret: string) =>
  createHmac('sha256', secret).update(payloadBase64).digest('base64url');

const resolveSecret = () => process.env.AUTH_SESSION_SECRET || '';

export const generateQrToken = (guestId: string) => {
  const normalizedGuestId = String(guestId || '').trim();
  if (!normalizedGuestId) {
    throw new Error('guestId obrigatorio para gerar token.');
  }

  const secret = resolveSecret();
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET nao configurada no backend.');
  }

  const payload: QrTokenPayload = {
    guestId: normalizedGuestId,
    timestamp: Date.now(),
  };

  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
};

export const verifyQrToken = (token: string): QrTokenVerificationResult => {
  if (!token || typeof token !== 'string') return null;

  const secret = resolveSecret();
  if (!secret) return null;

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = sign(payloadBase64, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as Partial<QrTokenPayload>;
    if (
      !payload ||
      typeof payload.guestId !== 'string' ||
      payload.guestId.trim().length === 0 ||
      typeof payload.timestamp !== 'number'
    ) {
      return null;
    }

    const now = Date.now();
    if (payload.timestamp > now + MAX_FUTURE_SKEW_MS) return null;
    if (now - payload.timestamp > QR_TOKEN_TTL_MS) return 'expired';

    return {
      guestId: payload.guestId.trim(),
      timestamp: payload.timestamp,
    };
  } catch {
    return null;
  }
};
