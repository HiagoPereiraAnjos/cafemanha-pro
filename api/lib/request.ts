const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

type ParseJsonBodySuccess<T = any> = {
  ok: true;
  data: T;
};

type ParseJsonBodyError = {
  ok: false;
  statusCode: number;
  error: string;
};

export type ParseJsonBodyResult<T = any> = ParseJsonBodySuccess<T> | ParseJsonBodyError;

class BodyTooLargeError extends Error {
  constructor() {
    super('Corpo da requisicao excede o limite permitido.');
    this.name = 'BodyTooLargeError';
  }
}

const readRawBody = (req: any, maxBytes: number): Promise<string> =>
  new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];

    const cleanup = () => {
      req.off?.('data', onData);
      req.off?.('end', onEnd);
      req.off?.('error', onError);
    };

    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytes += buffer.length;
      if (bytes > maxBytes) {
        cleanup();
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(buffer);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8'));
    };

    const onError = (error: unknown) => {
      cleanup();
      reject(error);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });

export const parseJsonBody = async <T = any>(
  req: any,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<ParseJsonBodyResult<T>> => {
  if (req.body && typeof req.body === 'object') {
    return { ok: true, data: req.body as T };
  }

  try {
    const rawBody =
      typeof req.body === 'string' ? req.body : await readRawBody(req, maxBytes);

    if (typeof rawBody === 'string' && Buffer.byteLength(rawBody, 'utf8') > maxBytes) {
      return {
        ok: false,
        statusCode: 413,
        error: 'Corpo da requisicao excede o limite permitido.',
      };
    }

    if (!rawBody) return { ok: true, data: {} as T };

    try {
      return {
        ok: true,
        data: JSON.parse(rawBody) as T,
      };
    } catch {
      return {
        ok: false,
        statusCode: 400,
        error: 'Requisicao invalida.',
      };
    }
  } catch (error: unknown) {
    if (error instanceof BodyTooLargeError) {
      return {
        ok: false,
        statusCode: 413,
        error: 'Corpo da requisicao excede o limite permitido.',
      };
    }

    return {
      ok: false,
      statusCode: 400,
      error: 'Requisicao invalida.',
    };
  }
};

