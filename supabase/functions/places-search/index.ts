import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  locality?: string;
  rating?: number;
  reviewCount?: number;
  distanceKm?: number;
  openNow?: boolean;
  hours?: string;
  location?: { lat: number; lng: number };
  placeId: string;
  photoUrl?: string;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "nearby";

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Google Places API key not configured",
          needsConfig: true,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body or query params
    let body: {
      lat?: number;
      lng?: number;
      query?: string;
      radius?: number;
    } = {};

    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    } else {
      body = {
        lat: url.searchParams.get("lat")
          ? parseFloat(url.searchParams.get("lat")!)
          : undefined,
        lng: url.searchParams.get("lng")
          ? parseFloat(url.searchParams.get("lng")!)
          : undefined,
        query: url.searchParams.get("query") || undefined,
        radius: url.searchParams.get("radius")
          ? parseInt(url.searchParams.get("radius")!)
          : undefined,
      };
    }

    const radius = body.radius || 5000;

    // Google Places API (New) — v1
    const placesApiBase = "https://places.googleapis.com/v1/places:searchText";
    const placesNearbyBase =
      "https://places.googleapis.com/v1/places:searchNearby";

    const fieldMask =
      "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.currentOpeningHours,places.photos,places.shortFormattedAddress,places.addressComponents";

    let results: PlaceResult[] = [];

    if (action === "search" && body.query) {
      // Text Search
      const searchText = body.query.includes("pupus") ||
        body.query.includes("pupuser")
        ? body.query
        : `pupusería ${body.query}`;

      const searchBody: Record<string, unknown> = {
        textQuery: searchText,
        languageCode: "es",
        regionCode: "SV",
        pageSize: 20,
      };

      if (body.lat !== undefined && body.lng !== undefined) {
        searchBody.locationBias = {
          circle: {
            center: { latitude: body.lat, longitude: body.lng },
            radius: radius,
          },
        };
      }

      const response = await fetch(placesApiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Google Places Text Search error:", errText);
        return new Response(
          JSON.stringify({
            error: "Google Places API request failed",
            details: errText,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const places = data.places || [];

      results = places.map((p: Record<string, unknown>) => {
        const location = p.location as
          | { latitude: number; longitude: number }
          | undefined;
        const openingHours = p.currentOpeningHours as
          | { openNow: boolean; weekdayDescriptions?: string[] }
          | undefined;
        const addressComponents = p.addressComponents as
          | Array<{ shortText?: string; types?: string[] }>
          | undefined;

        let locality: string | undefined;
        if (addressComponents) {
          for (const comp of addressComponents) {
            if (comp.types?.includes("locality") || comp.types?.includes("administrative_area_level_1")) {
              locality = comp.shortText;
              break;
            }
          }
        }

        let distanceKm: number | undefined;
        if (
          location &&
          body.lat !== undefined &&
          body.lng !== undefined
        ) {
          distanceKm = haversineKm(
            body.lat,
            body.lng,
            location.latitude,
            location.longitude
          );
        }

        return {
          id: p.id as string,
          placeId: p.id as string,
          name: (p.displayName as { text: string })?.text || "",
          address: (p.formattedAddress as string) || "",
          locality,
          rating: p.rating as number | undefined,
          reviewCount: p.userRatingCount as number | undefined,
          distanceKm,
          openNow: openingHours?.openNow,
          hours: openingHours?.weekdayDescriptions?.join(", "),
          location: location
            ? { lat: location.latitude, lng: location.longitude }
            : undefined,
        };
      });
    } else if (action === "nearby" && body.lat !== undefined && body.lng !== undefined) {
      // Nearby Search
      const nearbyBody = {
        includedTypes: ["restaurant"],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: body.lat, longitude: body.lng },
            radius: radius,
          },
        },
        languageCode: "es",
        regionCode: "SV",
      };

      const response = await fetch(placesNearbyBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(nearbyBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Google Places Nearby Search error:", errText);
        return new Response(
          JSON.stringify({
            error: "Google Places API request failed",
            details: errText,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const places = data.places || [];

      results = places
        .filter((p: Record<string, unknown>) => {
          const name = ((p.displayName as { text: string })?.text || "").toLowerCase();
          return (
            name.includes("pupus") ||
            name.includes("pupuser") ||
            name.includes("comedor") ||
            name.includes("comida")
          );
        })
        .map((p: Record<string, unknown>) => {
          const location = p.location as
            | { latitude: number; longitude: number }
            | undefined;
          const openingHours = p.currentOpeningHours as
            | { openNow: boolean; weekdayDescriptions?: string[] }
            | undefined;
          const addressComponents = p.addressComponents as
            | Array<{ shortText?: string; types?: string[] }>
            | undefined;

          let locality: string | undefined;
          if (addressComponents) {
            for (const comp of addressComponents) {
              if (
                comp.types?.includes("locality") ||
                comp.types?.includes("administrative_area_level_1")
              ) {
                locality = comp.shortText;
                break;
              }
            }
          }

          let distanceKm: number | undefined;
          if (location) {
            distanceKm = haversineKm(
              body.lat!,
              body.lng!,
              location.latitude,
              location.longitude
            );
          }

          return {
            id: p.id as string,
            placeId: p.id as string,
            name: (p.displayName as { text: string })?.text || "",
            address: (p.formattedAddress as string) || "",
            locality,
            rating: p.rating as number | undefined,
            reviewCount: p.userRatingCount as number | undefined,
            distanceKm,
            openNow: openingHours?.openNow,
            hours: openingHours?.weekdayDescriptions?.join(", "),
            location: location
              ? { lat: location.latitude, lng: location.longitude }
              : undefined,
          };
        });
    } else {
      return new Response(
        JSON.stringify({
          error: "Invalid action or missing parameters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sort by distance when available
    results.sort((a, b) => {
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });

    return new Response(
      JSON.stringify({
        results,
        count: results.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
