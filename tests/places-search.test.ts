import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La función lee las variables al cargarse, así que se importa después de definirlas.
process.env.GOOGLE_PLACES_API_KEY = 'test-key';
const { handlePlacesRequest } = await import('../api/places-search');

const googleResponse = {
  places: [
    { id: 'a', displayName: { text: 'Pupusería Lejos' }, location: { latitude: 13.8, longitude: -89.2 } },
    { id: 'b', displayName: { text: 'Pupusería Cerca' }, location: { latitude: 13.7, longitude: -89.2 } },
    { id: 'c', displayName: { text: 'Burger King' }, location: { latitude: 13.7, longitude: -89.2 } },
  ],
};

const post = (action: string, body: unknown, ip = '1.1.1.1') =>
  handlePlacesRequest(
    new Request(`https://x/api/places-search?action=${action}`, {
      method: 'POST',
      headers: { 'x-real-ip': ip, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

describe('api/places-search', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(googleResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve pupuserías cercanas ordenadas por distancia y sin restaurantes que no son pupuserías', async () => {
    const r = await post('nearby', { lat: 13.69, lng: -89.2 }, '2.2.2.2');
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.results.map((x: { name: string }) => x.name)).toEqual(['Pupusería Cerca', 'Pupusería Lejos']);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('test-key');
  });

  it('cachea búsquedas de la misma zona', async () => {
    await post('nearby', { lat: 13.5, lng: -89.5 }, '3.3.3.3');
    const r = await post('nearby', { lat: 13.5001, lng: -89.5001 }, '3.3.3.3');
    expect(r.headers.get('X-Cache')).toBe('HIT');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('valida la entrada y el método', async () => {
    expect((await post('nearby', { lat: 999, lng: 0 }, '4.4.4.4')).status).toBe(400);
    expect((await handlePlacesRequest(new Request('https://x/api/places-search', { method: 'GET' }))).status).toBe(405);
  });

  it('limita a 30 búsquedas por minuto por IP', async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await post('search', { query: `q${i}` }, '9.9.9.9')).status;
    expect(last).toBe(429);
  });

  it('no filtra el error de Google al cliente', async () => {
    fetchMock.mockResolvedValueOnce(new Response('API key inválida: detalles internos', { status: 403 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post('search', { query: 'unica' }, '5.5.5.5');
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain('detalles internos');
  });
});
