# Hotel Breakfast Control Pro

Aplicação web para controle de café da manhã em hotel, com fluxo para:

- recepção importar e cadastrar hóspedes
- hóspede gerar QR Code
- restaurante validar consumo
- persistência de dados no Supabase

## Tecnologias

- React + TypeScript
- Vite
- Supabase
- React Router
- Vercel Functions (`/api/*`)

## Requisitos

- Node.js 18+ (recomendado)
- npm

## Configuração

Crie ou ajuste o arquivo `.env.local` com:

```env
SUPABASE_URL=SEU_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
SUPABASE_TABLE=cafe_manha

AUTH_PASSWORD_RECEPCAO=sua_senha_recepcao
AUTH_PASSWORD_RESTAURANTE=sua_senha_restaurante
AUTH_PASSWORD_VALIDAR=sua_senha_validar
AUTH_SESSION_SECRET=um_segredo_longo_e_aleatorio

VITE_PUBLIC_BASE_URL=https://cafemanha-pro.vercel.app/
```

`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_PASSWORD_*` e `AUTH_SESSION_SECRET` são backend-only (não usar prefixo `VITE_`).

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Deploy no Vercel

1. Suba o projeto para o GitHub.
2. Importe o repositório no Vercel.
3. Configure as variáveis de ambiente acima no projeto da Vercel.
4. Faça deploy.

## Fluxos principais

- Recepção: importa planilha e salva hóspedes no banco
- Hóspede: informa quarto/nome ou acessa link do quarto para gerar QR individual
- Validar: leitura do QR e atualização de status para utilizado
