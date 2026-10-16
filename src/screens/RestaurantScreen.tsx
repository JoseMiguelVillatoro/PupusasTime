import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  MapPin,
  Check,
  Star,
  Clock,
  X,
  Navigation,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Theme } from '@/hooks/useTheme';
import { PlaceRestaurant } from '@/data/pupusa';

interface Props {
  onSelect: (restaurant: PlaceRestaurant | null) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onContinue: () => void;
  onBack: () => void;
  selected: PlaceRestaurant | null;
}

/** Vercel Function del mismo repo (api/places-search.ts), en el mismo dominio. */
const PLACES_ENDPOINT = '/api/places-search';

type LocationState = 'idle' | 'requesting' | 'granted' | 'denied';
type ViewMode = 'list' | 'detail';

/** Pupusería escrita a mano: la llave `manual:<nombre>` sirve para recordar sus precios. */
function manualRestaurant(name: string): PlaceRestaurant {
  const clean = name.trim();
  const slug = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return { id: `manual:${slug}`, placeId: `manual:${slug}`, name: clean, address: '' };
}

function formatDistance(km?: number): string {
  if (km === undefined) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatReviewCount(count?: number): string {
  if (count === undefined) return '';
  return count.toLocaleString('es');
}

export function RestaurantScreen({
  onSelect,
  theme,
  onToggleTheme,
  onContinue,
  onBack,
  selected,
}: Props) {
  const [manualName, setManualName] = useState(selected?.placeId.startsWith('manual:') ? selected.name : '');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [restaurants, setRestaurants] = useState<PlaceRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [detailRestaurant, setDetailRestaurant] = useState<PlaceRestaurant | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState('denied');
      return;
    }

    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationState('granted');
      },
      () => {
        setLocationState('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Reverse geocode for city name (using free OpenStreetMap Nominatim)
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'es' } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const addr = data.address || {};
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          addr.state ||
          '';
        setCityName(city);
      } catch {
        // silent — city name is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  // Fetch nearby restaurants when location is granted
  const fetchNearby = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    setNeedsConfig(false);
    try {
      const res = await fetch(
        `${PLACES_ENDPOINT}?action=nearby`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: coords.lat, lng: coords.lng, radius: 8000 }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.needsConfig) {
          setNeedsConfig(true);
          return;
        }
        throw new Error(errData.error || 'Error al buscar pupuserías');
      }
      const data = await res.json();
      setRestaurants(data.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [coords]);

  useEffect(() => {
    if (locationState === 'granted' && coords) {
      fetchNearby();
    }
  }, [locationState, coords, fetchNearby]);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchMode(false);
        setRestaurants([]);
        if (coords) fetchNearby();
        return;
      }
      setSearchMode(true);
      setLoading(true);
      setError(null);
      setNeedsConfig(false);
      try {
        const res = await fetch(
          `${PLACES_ENDPOINT}?action=search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              lat: coords?.lat,
              lng: coords?.lng,
              radius: 50000,
            }),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (errData.needsConfig) {
            setNeedsConfig(true);
            return;
          }
          throw new Error(errData.error || 'Error en la búsqueda');
        }
        const data = await res.json();
        setRestaurants(data.results || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [coords, fetchNearby]
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchMode(false);
      if (coords && locationState === 'granted') {
        searchTimer.current = setTimeout(() => fetchNearby(), 100);
      }
      return;
    }
    searchTimer.current = setTimeout(() => performSearch(query), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, coords, locationState, fetchNearby, performSearch]);

  const handleSelect = (r: PlaceRestaurant) => {
    onSelect(r);
  };

  const openDetail = (r: PlaceRestaurant) => {
    setDetailRestaurant(r);
    setViewMode('detail');
  };

  const closeDetail = () => {
    setDetailRestaurant(null);
    setViewMode('list');
  };

  // DETAIL VIEW
  if (viewMode === 'detail' && detailRestaurant) {
    const r = detailRestaurant;
    const mapSrc = r.location
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${r.location.lng - 0.005}%2C${r.location.lat - 0.005}%2C${r.location.lng + 0.005}%2C${r.location.lat + 0.005}&layer=mapnik&marker=${r.location.lat}%2C${r.location.lng}`
      : '';
    const mapsLink = r.location
      ? `https://www.google.com/maps/search/?api=1&query=${r.location.lat},${r.location.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}`;

    return (
      <div className="min-h-screen flex flex-col">
        <TopBar onBack={closeDetail} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

        <div className="flex-1 px-5 pt-4 overflow-y-auto pb-40">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-display text-2xl font-bold text-charcoal-900 dark:text-cream-50">
              {r.name}
            </h2>
            <button
              onClick={() => handleSelect(r)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 no-tap-highlight ${
                selected?.id === r.id
                  ? 'bg-terracotta-400 shadow-pop'
                  : 'border-2 border-cream-300 dark:border-night-50 hover:border-terracotta-300'
              }`}
              aria-label={selected?.id === r.id ? 'Seleccionada' : 'Seleccionar esta pupusería'}
            >
              <Check
                className={`w-5 h-5 ${
                  selected?.id === r.id ? 'text-white' : 'text-transparent'
                }`}
                strokeWidth={3}
              />
            </button>
          </div>

          {/* Rating + reviews */}
          {(r.rating || r.reviewCount) && (
            <div className="flex items-center gap-3 mb-4 text-sm">
              {r.rating && (
                <span className="flex items-center gap-1 font-semibold text-charcoal-800 dark:text-cream-100">
                  <Star className="w-4 h-4 fill-terracotta-400 text-terracotta-400" />
                  {r.rating.toFixed(1)}
                </span>
              )}
              {r.reviewCount && (
                <span className="text-charcoal-700 dark:text-cream-200">
                  {formatReviewCount(r.reviewCount)} reseñas
                </span>
              )}
            </div>
          )}

          {/* Address */}
          <div className="flex items-start gap-2 mb-4 text-sm text-charcoal-700 dark:text-cream-200">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{r.address}</span>
          </div>

          {/* Distance */}
          {r.distanceKm !== undefined && (
            <div className="flex items-center gap-2 mb-4 text-sm text-charcoal-700 dark:text-cream-200">
              <Navigation className="w-4 h-4 shrink-0" />
              <span>{formatDistance(r.distanceKm)}</span>
            </div>
          )}

          {/* Open/closed */}
          {r.openNow !== undefined && (
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  r.openNow
                    ? 'bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${r.openNow ? 'bg-olive-500' : 'bg-red-500'}`} />
                {r.openNow ? 'Abierto ahora' : 'Cerrado'}
              </span>
            </div>
          )}

          {/* Hours */}
          {r.hours && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-100 mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Horarios
              </p>
              <div className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 p-4 space-y-1">
                {r.hours.split(',').map((line, i) => (
                  <p key={i} className="text-sm text-charcoal-700 dark:text-cream-200">
                    {line.trim()}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {mapSrc && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-100 mb-2">
                Ubicación
              </p>
              <div className="rounded-2xl overflow-hidden border border-cream-200 dark:border-night-100">
                <iframe
                  src={mapSrc}
                  className="w-full h-48"
                  loading="lazy"
                  title="Mapa"
                />
              </div>
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-terracotta-500 hover:text-terracotta-600"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver en Google Maps
              </a>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
          <Button
            onClick={() => {
              handleSelect(r);
              setTimeout(() => onContinue(), 0);
            }}
          >
            {selected?.id === r.id ? 'Seleccionada ✓' : 'Elegir esta pupusería →'}
          </Button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  const showLocationPrompt = locationState === 'denied';
  const showSearching = locationState === 'requesting';
  const showNearby = locationState === 'granted' && !searchMode;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

      <div className="px-5 pb-2">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">
          ¿Dónde estamos comiendo?
        </h2>
        <p className="text-sm text-charcoal-700 dark:text-cream-200">Es opcional: sirve para el texto de la orden y para recordar los precios.</p>

        {/* Location status */}
        {showSearching && (
          <div className="flex items-center gap-2 text-charcoal-700 dark:text-cream-200 mt-3 mb-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">📍 Buscando tu ubicación...</span>
          </div>
        )}

        {showNearby && (
          <div className="mt-3 mb-3">
            <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-100">
              📍 {cityName ? `Estás en ${cityName}` : 'Ubicación encontrada'}
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mt-0.5">
              {loading
                ? 'Buscando pupuserías cercanas…'
                : error || needsConfig
                  ? 'No pudimos buscar pupuserías ahora. Escribí el nombre abajo.'
                  : restaurants.length > 0
                    ? 'Estas son las pupuserías cerca de vos'
                    : 'No encontramos pupuserías cerca'}
            </p>
          </div>
        )}

        {showLocationPrompt && (
          <div className="mt-3 mb-3">
            <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-100">
              ¿Dónde estás?
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mt-0.5">
              Buscá tu ciudad, zona o pupusería
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3 mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-700/50 dark:text-cream-200/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pupusería..."
            className="w-full pl-12 pr-10 py-4 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/40 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 focus:bg-white dark:focus:bg-night-200 transition-colors text-base"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream-200 dark:bg-night-100 flex items-center justify-center text-charcoal-700 dark:text-cream-200 active:scale-90 transition-transform no-tap-highlight"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-5 space-y-3 overflow-y-auto pb-40">
        {/* API key no configurada: solo se avisa en desarrollo */}
        {needsConfig && import.meta.env.DEV && (
          <div className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border border-terracotta-200 dark:border-terracotta-600/30 p-5 text-center">
            <AlertCircle className="w-8 h-8 text-terracotta-400 mx-auto mb-3" />
            <p className="font-semibold text-charcoal-800 dark:text-cream-100 mb-1">
              Google Places API no configurado
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200">
              Para activar la búsqueda de pupuserías reales, agregá la variable{' '}
              <code className="text-terracotta-500 font-semibold">GOOGLE_PLACES_API_KEY</code>{' '}
              en las variables de entorno del proyecto en Vercel.
            </p>
          </div>
        )}

        {/* Escribir el nombre a mano: siempre disponible */}
        {!loading && (
          <form
            className="rounded-2xl border-2 border-dashed border-cream-300 dark:border-night-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualName.trim()) onSelect(manualRestaurant(manualName));
            }}
          >
            <label htmlFor="manual-restaurant" className="block font-bold text-charcoal-900 dark:text-cream-50 mb-1">
              ¿No aparece? Escribí el nombre
            </label>
            <div className="flex gap-2 mt-2">
              <input
                id="manual-restaurant"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Pupusería de la esquina"
                maxLength={60}
                className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 transition-colors"
              />
              <button
                type="submit"
                disabled={!manualName.trim()}
                className="px-4 rounded-xl bg-terracotta-500 text-white font-bold disabled:opacity-40 active:scale-95 transition-transform no-tap-highlight shrink-0"
              >
                {selected?.placeId === manualRestaurant(manualName || ' ').placeId ? <Check className="w-5 h-5" strokeWidth={3} /> : 'Usar'}
              </button>
            </div>
          </form>
        )}

        {/* Loading */}
        {loading && !needsConfig && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-terracotta-400 animate-spin mb-3" />
            <p className="text-sm text-charcoal-700 dark:text-cream-200">
              {searchMode ? 'Buscando...' : 'Cargando pupuserías...'}
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && !needsConfig && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-5 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-charcoal-800 dark:text-cream-100 mb-1">
              No pudimos buscar pupuserías
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200">Revisá tu conexión o escribí el nombre a mano.</p>
          </div>
        )}

        {/* Restaurant cards */}
        {!loading && !error && !needsConfig && restaurants.length > 0 && (
          restaurants.map((r) => {
            const isSel = selected?.id === r.id;
            return (
              <div
                key={r.id}
                className={`p-4 rounded-2xl border-2 transition-all flex gap-3 ${
                  isSel
                    ? 'border-terracotta-400 bg-terracotta-50 dark:bg-terracotta-700/30 shadow-soft'
                    : 'border-cream-200 dark:border-night-100 bg-cream-50 dark:bg-night-300'
                }`}
              >
                <button
                  onClick={() => openDetail(r)}
                  className="flex-1 text-left no-tap-highlight"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-charcoal-900 dark:text-cream-50 text-base leading-tight">
                        {r.name}
                      </p>
                    </div>
                  </div>

                  {/* Rating + reviews */}
                  {(r.rating || r.reviewCount) && (
                    <div className="flex items-center gap-2 mb-1.5 text-sm">
                      {r.rating && (
                        <span className="flex items-center gap-0.5 font-semibold text-charcoal-800 dark:text-cream-100">
                          <Star className="w-3.5 h-3.5 fill-terracotta-400 text-terracotta-400" />
                          {r.rating.toFixed(1)}
                        </span>
                      )}
                      {r.reviewCount && (
                        <span className="text-charcoal-700 dark:text-cream-200">
                          · {formatReviewCount(r.reviewCount)} reseñas
                        </span>
                      )}
                    </div>
                  )}

                  {/* Distance + locality */}
                  <div className="flex items-center gap-1.5 text-sm text-charcoal-700 dark:text-cream-200">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {r.distanceKm !== undefined && formatDistance(r.distanceKm)}
                    {r.distanceKm !== undefined && (r.locality || r.address) && ' · '}
                    {r.locality || r.address}
                  </div>

                  {/* Open/closed */}
                  {r.openNow !== undefined && (
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          r.openNow
                            ? 'text-olive-600 dark:text-olive-300'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${r.openNow ? 'bg-olive-500' : 'bg-red-500'}`} />
                        {r.openNow ? 'Abierto ahora' : 'Cerrado'}
                      </span>
                    </div>
                  )}
                </button>

                {/* Checkmark select button — always visible */}
                <button
                  onClick={() => handleSelect(r)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 no-tap-highlight ${
                    isSel
                      ? 'bg-terracotta-400 shadow-pop'
                      : 'border-2 border-cream-300 dark:border-night-50 hover:border-terracotta-300'
                  }`}
                  aria-label={isSel ? 'Seleccionada' : 'Seleccionar esta pupusería'}
                >
                  <Check
                    className={`w-4 h-4 ${
                      isSel ? 'text-white' : 'text-transparent'
                    }`}
                    strokeWidth={3}
                  />
                </button>
              </div>
            );
          })
        )}

        {/* Empty state — only when no results and no fallback conditions met */}
        {!loading && !error && !needsConfig && restaurants.length === 0 && !showSearching && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🫓</p>
            <p className="text-charcoal-700 dark:text-cream-200 font-semibold">
              {searchMode
                ? 'No encontramos esa pupusería'
                : showLocationPrompt
                  ? 'Buscá una pupusería para empezar'
                  : 'No encontramos pupuserías cerca'}
            </p>
            <p className="text-charcoal-700/60 dark:text-cream-200/50 text-sm mt-1">
              {searchMode
                ? 'Probá con otro nombre'
                : 'Probá buscando por nombre'}
            </p>
          </div>
        )}
      </div>

      {/* Continue button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
        <Button onClick={onContinue}>
          {selected ? `Continuar con ${selected.name}` : 'Seguir sin elegir pupusería'}
        </Button>
      </div>
    </div>
  );
}
