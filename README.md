# Pupusas Time 🫓

Organizá la pupuseada sin enredos: cada quien elige sus pupusas, la app arma el
pedido consolidado listo para dictarle a la mesera y calcula cuánto paga cada
cuenta, propina incluida.

## Flujo

1. **Pupusería** — busca pupuserías cercanas (Google Places) o por nombre.
2. **Personas** — cuántos son y cómo se llaman.
3. **Cuentas** — una sola, cada quien la suya, o grupos personalizados.
4. **Pedido** — cada persona elige especialidad, masa (maíz o arroz) y cantidad.
5. **Resumen** — pedido consolidado por masa, listo para copiar y compartir.
6. **Pago** — precio por especialidad + propina → total por cuenta.

## Stack

- React 18 + TypeScript + Vite + Tailwind CSS
- Supabase Edge Function (`supabase/functions/places-search`) como proxy a Google Places
- Vitest para la lógica de pedidos y pagos

## Desarrollo

```bash
npm install
cp .env.example .env   # y completá las variables
npm run dev
```

| Script              | Qué hace                         |
| ------------------- | -------------------------------- |
| `npm run dev`       | Servidor de desarrollo           |
| `npm test`          | Tests de lógica (Vitest)         |
| `npm run typecheck` | Chequeo de tipos                 |
| `npm run lint`      | ESLint                           |
| `npm run build`     | Build de producción en `dist/`   |

### Variables del frontend (`.env`)

```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Edge Function `places-search`

Secrets en Supabase:

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=<key>
supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.com,http://localhost:5173
supabase functions deploy places-search
```

La función es pública (`verify_jwt = false`), así que se protege con lista de
orígenes, rate limit por IP, caché de 10 minutos y validación de entrada. Para
blindar el costo, en Google Cloud también conviene:

- Restringir la API key a **Places API (New)**.
- Poner una **cuota diaria** de requests y una **alerta de presupuesto**.

## Notas sobre el dinero

Todos los montos se calculan en **centavos enteros** (`src/data/consolidation.ts`).
La propina se reparte con el método del mayor residuo, así que la suma de las
cuentas siempre cuadra exacto con el total.
