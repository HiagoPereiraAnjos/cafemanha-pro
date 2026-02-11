import { serializeClearedSessionCookie } from './_session.js';

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Metodo nao permitido.' });
    return;
  }

  res.setHeader('Set-Cookie', serializeClearedSessionCookie());
  sendJson(res, 200, { ok: true });
}
