# Mess Distribution Frontend

Next.js 16 App Router prototype for SRB-Special Response Battalion mess distribution roles (CC, Daily, Mess, Consume, Ration).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker (this folder)

```bash
docker compose up --build
# UI http://localhost:3000  API http://localhost:8000
# login daily@mess.rab / ChangeMe!

# hot reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Copy `env.docker.example` values to override ports or secrets. Host `:3000` / `:8000` must be free, or set `WEB_PORT` / `API_PORT`. Browser calls the published API (`NEXT_PUBLIC_API_URL=http://localhost:8000`).

## Demo

See [../docs/DEMO.md](../docs/DEMO.md) for the full walkthrough.

## Stack

- Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript
- localStorage mock store (no backend)
- i18n: `src/i18n/messages/en.ts` (+ `bn.ts`)

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
