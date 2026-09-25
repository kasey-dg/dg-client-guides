// Live ratings + reviews for guide places.
//   GET /.netlify/functions/reviews?check=1                 -> which sources are configured
//   GET /.netlify/functions/reviews?source=tripadvisor|google&name=..&lat=..&lng=..[&category=restaurants|attractions][&id=<override>][&mode=summary]
//   mode=summary returns just the rating, count and link (cheaper; used for the star line on each card)
// Keys live in Netlify env vars (never in the guide pages):
//   TRIPADVISOR_API_KEY   Tripadvisor Content API key (restrict it to the dg-guides.netlify.app domain)
//   GOOGLE_PLACES_API_KEY Google Places API (New) key (restrict it to the Places API)
//   INLINE_SOURCES        optional, e.g. "tripadvisor" to show only Tripadvisor stars on cards (default: every configured source)
const SITE = "https://dg-guides.netlify.app";
const TA = "https://api.content.tripadvisor.com/api/v1";

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
function reply(body, { status = 200, cache = "no-store" } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": cache },
  });
}
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Guide titles carry extras ("Red Salt, Koa Kea Hotel", "Bistrot Paul Bert (11th)"): search on the core name.
const coreName = (n) => n.replace(/\s*\([^)]*\)\s*/g, " ").split(",")[0].trim();

async function tripadvisor(key, q) {
  const H = { Referer: SITE, Accept: "application/json" };
  let id = q.id;
  if (!id) {
    const u = new URL(TA + "/location/search");
    u.search = new URLSearchParams({ key, searchQuery: coreName(q.name), latLong: `${q.lat},${q.lng}`, language: "en", ...(q.category ? { category: q.category } : {}) });
    const s = await fetch(u, { headers: H });
    if (!s.ok) throw new Error("search " + s.status);
    const list = (await s.json()).data || [];
    const want = norm(coreName(q.name));
    const scored = list.map((l) => ({ l, n: norm(l.name) })).filter((x) => x.n && (x.n.includes(want) || want.includes(x.n)));
    const pick = scored[0]?.l || null;
    if (!pick) return { found: false };
    id = pick.location_id;
  }
  const d = new URL(`${TA}/location/${id}/details`);
  d.search = new URLSearchParams({ key, language: "en", currency: "USD" });
  const r = new URL(`${TA}/location/${id}/reviews`);
  r.search = new URLSearchParams({ key, language: "en" });
  const summary = q.mode === "summary";
  const [dr, rr] = await Promise.all([fetch(d, { headers: H }), summary ? null : fetch(r, { headers: H })]);
  if (!dr.ok) throw new Error("details " + dr.status);
  const det = await dr.json();
  if (q.lat && det.latitude && dist([+q.lat, +q.lng], [+det.latitude, +det.longitude]) > 3000) return { found: false };
  const revs = rr && rr.ok ? (await rr.json()).data || [] : [];
  return {
    found: true,
    name: det.name,
    rating: det.rating ? +det.rating : null,
    count: det.num_reviews ? +det.num_reviews : null,
    ratingImage: det.rating_image_url || null,
    ranking: det.ranking_data?.ranking_string || null,
    url: det.web_url || null,
    reviews: revs.slice(0, 5).map((v) => ({
      rating: v.rating, ratingImage: v.rating_image_url || null, title: v.title || "", text: v.text || "",
      author: v.user?.username || "Tripadvisor reviewer", date: v.published_date || null, url: v.url || det.web_url || null,
    })),
  };
}

async function google(key, q) {
  const fields = "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.location" + (q.mode === "summary" ? "" : ",places.reviews");
  let place;
  if (q.id) {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(q.id)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields.replace(/places\./g, "") },
    });
    if (!res.ok) throw new Error("details " + res.status);
    place = await res.json();
  } else {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      body: JSON.stringify({
        textQuery: coreName(q.name), maxResultCount: 1, languageCode: "en",
        locationBias: { circle: { center: { latitude: +q.lat, longitude: +q.lng }, radius: 500 } },
      }),
    });
    if (!res.ok) throw new Error("search " + res.status);
    place = ((await res.json()).places || [])[0];
    if (!place) return { found: false };
    const loc = place.location;
    if (loc && dist([+q.lat, +q.lng], [loc.latitude, loc.longitude]) > 3000) return { found: false };
  }
  return {
    found: true,
    name: place.displayName?.text || q.name,
    rating: place.rating ?? null,
    count: place.userRatingCount ?? null,
    url: place.googleMapsUri || null,
    reviews: (place.reviews || []).slice(0, 5).map((v) => ({
      rating: v.rating, title: "", text: v.originalText?.text || v.text?.text || "",
      author: v.authorAttribution?.displayName || "Google user", authorUrl: v.authorAttribution?.uri || null,
      date: v.publishTime || null, when: v.relativePublishTimeDescription || null, url: v.googleMapsUri || place.googleMapsUri || null,
    })),
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const keys = { tripadvisor: process.env.TRIPADVISOR_API_KEY, google: process.env.GOOGLE_PLACES_API_KEY };
  const configured = Object.keys(keys).filter((k) => keys[k]);
  const inline = process.env.INLINE_SOURCES ? process.env.INLINE_SOURCES.split(",").map((x) => x.trim()).filter((x) => configured.includes(x)) : configured;
  if (p.check) return reply({ sources: configured, inline }, { cache: "public, s-maxage=300" });

  const src = p.source;
  if (!keys[src]) return reply({ source: src, configured: false });
  if (!p.name || !p.lat || !p.lng) return reply({ error: "name, lat and lng are required" }, { status: 400 });
  try {
    const data = src === "tripadvisor" ? await tripadvisor(keys[src], p) : await google(keys[src], p);
    // Tripadvisor results are cached at Netlify's edge for a day to stay inside the free tier.
    // Google's terms don't allow storing ratings or reviews, so Google is always fetched live.
    return reply({ source: src, configured: true, ...data }, { cache: src === "tripadvisor" ? "public, s-maxage=86400" : "no-store" });
  } catch (err) {
    console.error(src, err.message);
    return reply({ source: src, configured: true, error: "unavailable" }, { status: 502 });
  }
};
