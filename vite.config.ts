import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import authHandler from './api/auth';
import guestsHandler from './api/guests';
import issueQrHandler from './api/issue-qr';
import consumeHandler from './api/consume';
import meHandler from './api/me';

const applyEnvToProcess = (env: Record<string, string>) => {
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const runApiHandler = (handler: (req: any, res: any) => Promise<void>) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(handler(req, res))
      .then(() => {
        if (!res.writableEnded) next();
      })
      .catch((error) => {
        if (!res.writableEnded) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: false,
              error: error?.message || 'Erro interno no servidor local.',
            })
          );
          return;
        }
        next(error);
      });
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  applyEnvToProcess(env);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'local-api-routes',
        apply: 'serve',
        configureServer(server: any) {
          server.middlewares.use('/api/auth', runApiHandler(authHandler));
          server.middlewares.use('/api/me', runApiHandler(meHandler));
          server.middlewares.use('/api/guests', runApiHandler(guestsHandler));
          server.middlewares.use('/api/issue-qr', runApiHandler(issueQrHandler));
          server.middlewares.use('/api/consume', runApiHandler(consumeHandler));
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
