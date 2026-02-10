# Hotel Breakfast Control Pro

Aplicacao web para controle de cafe da manha em hotel, com fluxo para:

- recepcao importar e cadastrar hospedes
- hospede gerar QR Code
- restaurante validar consumo
- persistencia de dados no Supabase

## Tecnologias

- React + TypeScript
- Vite
- Supabase
- React Router

## Requisitos

- Node.js 18+ (recomendado)
- npm

## Configuracao

Crie ou ajuste o arquivo `.env.local` com:

```env
VITE_SUPABASE_URL=SEU_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=SEU_SUPABASE_ANON_KEY
VITE_SUPABASE_TABLE=cafe_manha
VITE_PUBLIC_BASE_URL=https://cafemanha-pro.vercel.app/
```

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de producao

```bash
npm run build
npm run preview
```

## Deploy no Vercel

1. Suba o projeto para o GitHub.
2. Importe o repositorio no Vercel.
3. Defina as variaveis de ambiente do `.env.local` no projeto da Vercel.
4. Faca deploy.

## Fluxos principais

- Recepcao: importa planilha e salva hospedes no Supabase
- Hospede: informa quarto/nome ou acessa link do quarto para gerar QR individual
- Validar: leitura do QR e atualizacao de status para utilizado

