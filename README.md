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
- Vercel: hosting y una Vercel Function (`api/places-search.ts`) como proxy a Google Places
- Vitest para la lógica de pedidos y pagos

Todo vive en este repo: no depende de Bolt ni de Supabase.

## Desarrollo

```bash
npm install
npm run dev            # la app, sin búsqueda de pupuserías (se puede escribir el nombre a mano)
npx vercel dev         # la app + /api/places-search, leyendo .env (copiá .env.example)
```

| Script              | Qué hace                         |
| ------------------- | -------------------------------- |
| `npm run dev`       | Servidor de desarrollo           |
| `npm test`          | Tests (Vitest)                   |
| `npm run typecheck` | Chequeo de tipos (app y api)     |
| `npm run lint`      | ESLint                           |
| `npm run build`     | Build de producción en `dist/`   |

## Despliegue en Vercel

Cada push a `main` despliega a producción; cada rama o PR genera una vista previa.

Variables de entorno del proyecto en Vercel (*Settings → Environment Variables*), para Production y Preview:

| Variable                | Obligatoria | Para qué |
| ----------------------- | ----------- | -------- |
| `GOOGLE_PLACES_API_KEY` | Sí          | Buscar pupuserías con Google Places |
| `ALLOWED_ORIGINS`       | No          | Dominios que pueden usar la búsqueda, separados por comas. Sin ella, se acepta cualquiera. |

Después de agregarlas o cambiarlas, hay que volver a desplegar.

La función `/api/places-search` es pública, así que se protege con lista de
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
