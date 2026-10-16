// Proxy hacia Google Places (New) para buscar pupuserías.
// La API key vive solo aquí. Como la función es pública (verify_jwt = false),
// se protege con: lista de orígenes permitidos, rate limit por IP, caché de
// respuestas, validación de entrada y un field mask mínimo (menos costo por request).
//
// Variables de entorno:
//   GOOGLE_PLACES_API_KEY  (obligatoria)
//   ALLOWED_ORIGINS        (opcional) lista separada por comas, ej:
//                          "https://pupusastime.com,http://localhost:5173"
//                          Si no se define, se acepta cualquier origen.

interface PlaceResult {
  id: string;
  placeId: string;
  name: string;
  address: string;
  locality?: string;
  rating?: number;
  reviewCount?: number;
  distanceKm?: number;
  openNow?: boolean;
  hours?: string;
  location?: { lat: number; lng: number };
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  addressComponents?: Array<{ shortText?: string; types?: string[] }>;
}

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

// Solo los campos que la app realmente muestra. Cada campo extra puede subir el SKU de precio.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.currentOpeningHours",
  "places.addressComponents",
].join(",");

const RATE_LIMIT_PER_MINUTE = 30;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_QUERY_LENGTH = 80;

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Estado en memoria por instancia: best-effort, pero corta abusos simples.
const hits = new Map<string, { count: number; windowStart: number }>();
const cache = new Map<string, { at: number; body: string }>();

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = allowedOrigins.length === 0 ? "*" : origin ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    Vary: "Origin",
  };
}

function json(status: number, data: unknown, origin: string | null, extra: Record<string, string> = {}) {
  return new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", ...extra },
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function pruneMaps() {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  for (const [k, v] of hits) if (now - v.windowStart > 60_000) hits.delete(k);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toResult(p: GooglePlace, origin?: { lat: number; lng: number }): PlaceResult {
  const locality = p.addressComponents?.find(
    (c) => c.types?.includes("locality") || c.types?.includes("administrative_area_level_1"),
  )?.shortText;
  const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined;
  return {
    id: p.id ?? "",
    placeId: p.id ?? "",
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    locality,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    distanceKm: loc && origin ? haversineKm(origin.lat, origin.lng, loc.lat, loc.lng) : undefined,
    openNow: p.currentOpeningHours?.openNow,
    hours: p.currentOpeningHours?.weekdayDescriptions?.join(", "),
    location: loc,
  };
}

const looksLikePupuseria = (name: string) => {
  const n = name.toLowerCase();
  return n.includes("pupus") || n.includes("comedor") || n.includes("comida");
};

function parseCoord(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
    return json(403, { error: "Origen no permitido" }, null);
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" }, origin);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return json(429, { error: "Demasiadas búsquedas, esperá un momento" }, origin, { "Retry-After": "60" });
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return json(503, { error: "Búsqueda no configurada", needsConfig: true }, origin);

  try {
    const action = new URL(req.url).searchParams.get("action") ?? "nearby";
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const lat = parseCoord(raw.lat, -90, 90);
    const lng = parseCoord(raw.lng, -180, 180);
    const coords = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
    const radiusNum = typeof raw.radius === "number" ? raw.radius : 5000;
    const radius = Math.min(Math.max(radiusNum, 100), 50000); // máximo que acepta Places
    const query = typeof raw.query === "string" ? raw.query.trim().slice(0, MAX_QUERY_LENGTH) : "";

    let url: string;
    let googleBody: Record<string, unknown>;

    if (action === "search" && query) {
      googleBody = {
        textQuery: query.toLowerCase().includes("pupus") ? query : `pupusería ${query}`,
        languageCode: "es",
        regionCode: "SV",
        pageSize: 20,
        ...(coords && {
          locationBias: { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius } },
        }),
      };
      url = SEARCH_URL;
    } else if (action === "nearby" && coords) {
      googleBody = {
        includedTypes: ["restaurant"],
        maxResultCount: 20,
        locationRestriction: { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius } },
        languageCode: "es",
        regionCode: "SV",
      };
      url = NEARBY_URL;
    } else {
      return json(400, { error: "Acción inválida o faltan parámetros" }, origin);
    }

    // ~100 m de precisión en la llave de caché: misma mesa, misma respuesta.
    const cacheKey = [
      action,
      query.toLowerCase(),
      coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : "",
      radius,
    ].join("|");
    pruneMaps();
    const cached = cache.get(cacheKey);
    if (cached) return json(200, cached.body, origin, { "X-Cache": "HIT" });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(googleBody),
    });

    if (!response.ok) {
      console.error(`Google Places ${action} error ${response.status}:`, await response.text());
      return json(502, { error: "No pudimos buscar pupuserías ahora mismo" }, origin);
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    let places = data.places ?? [];
    if (action === "nearby") places = places.filter((p) => looksLikePupuseria(p.displayName?.text ?? ""));

    const results = places.map((p) => toResult(p, coords));
    results.sort((a, b) =>
      a.distanceKm !== undefined && b.distanceKm !== undefined ? a.distanceKm - b.distanceKm : 0
    );

    const body = JSON.stringify({ results, count: results.length });
    cache.set(cacheKey, { at: Date.now(), body });
    return json(200, body, origin, { "X-Cache": "MISS" });
  } catch (err) {
    console.error("places-search error:", err);
    return json(500, { error: "Error inesperado" }, origin);
  }
});
