# Pupusas Time 🫓

Organizá la pupuseada sin enredos: cada quien elige sus pupusas, la app arma el
pedido consolidado listo para dictarle a la mesera y calcula cuánto paga cada
cuenta, propina incluida.

## Flujo

1. **Pupusería** (opcional) — buscá cerca con Google Places, escribí el nombre a mano o seguí sin elegir.
2. **Personas** — cuántos son y cómo se llaman. Se puede volver a agregar o quitar a cualquiera en cualquier momento.
3. **Pedido** — cada persona elige especialidad, masa (maíz o arroz) y cantidad, más bebidas y extras con su precio.
4. **Resumen** — orden consolidada para la mesera, lista para copiar.
5. **Cuentas** — una sola, cada quien la suya o grupos; se elige después de pedir.
6. **Pago** — precio por especialidad (o el mismo para todas) + propina → cuánto paga cada cuenta, para compartir por WhatsApp.

## Guardado en el teléfono

Todo se guarda en `localStorage`, sin cuentas ni servidor:

- `pupusastime:current:v1` — la pupuseada en curso; si se recarga la página, se retoma donde iba.
- `pupusastime:history:v1` — las últimas 100 pupuseadas terminadas, base para las estadísticas de la etapa 3.
- `pupusastime:prices:v1` — los últimos precios usados en cada pupusería.

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

## Arquitectura

- `src/state/pupuseada.ts` — reducer puro con todo el flujo de pantallas; en la etapa 2 se alimentará también de eventos en tiempo real.
- `src/state/storage.ts` — guardado local, historial y precios recordados.
- `src/data/consolidation.ts` — consolidación de pedidos y cálculo de pagos.
- Las personas se identifican con UUID, nunca por posición ni por nombre.

## Notas sobre el dinero

Todos los montos se calculan en **centavos enteros** (`src/data/consolidation.ts`).
La propina se reparte con el método del mayor residuo, así que la suma de las
cuentas siempre cuadra exacto con el total.
