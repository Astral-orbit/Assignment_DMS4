import { env } from "cloudflare:workers";

type Category = "attractions" | "restaurants" | "cafes" | "museums" | "hotels" | "parks" | "shopping" | "theaters" | "airports";
type Review = { author: string; rating: number; text: string; publishTime: string; relativeTime: string };
type OpeningPeriod = {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
};
type Bounds = { south: number; west: number; north: number; east: number };
type InstagramSignal = { caption: string; engagement: number; permalink: string; timestamp: string };
type NormalizedPlace = {
  id: string;
  name: string;
  address: string;
  category: Category;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  location: { latitude: number; longitude: number };
  googleMapsUri: string | null;
  photoName: string | null;
  photoAttribution: { displayName: string; uri: string | null } | null;
  reviews: Review[];
  recentReviewCount: number;
  source: "Google Places" | "OpenStreetMap";
  originalName: string | null;
  translationStatus: "localized" | "source-language";
  types: string[];
  primaryType: string | null;
  cuisine: string | null;
  regularOpeningHours: { periods: OpeningPeriod[]; weekdayDescriptions: string[] } | null;
  businessStatus: string | null;
  websiteUri: string | null;
  isLikelyChain: boolean;
  chainReason: string | null;
  trendScore: number;
  trendMentions: number;
  isInternationalAirport: boolean;
};

const categories: Array<{ key: Category; googleType: string; query: string; fallbackQuery: string }> = [
  { key: "attractions", googleType: "tourist_attraction", query: "top attractions theme parks and amusement parks", fallbackQuery: "attractions" },
  { key: "restaurants", googleType: "restaurant", query: "best independent restaurants bars and pubs", fallbackQuery: "restaurants and bars" },
  { key: "cafes", googleType: "cafe", query: "best cafes", fallbackQuery: "cafes" },
  { key: "museums", googleType: "museum", query: "famous museums and art galleries", fallbackQuery: "museums and galleries" },
  { key: "hotels", googleType: "hotel", query: "recommended hotels", fallbackQuery: "hotels" },
  { key: "parks", googleType: "park", query: "parks", fallbackQuery: "parks" },
  { key: "shopping", googleType: "shopping_mall", query: "department stores and shopping malls", fallbackQuery: "department stores" },
  { key: "theaters", googleType: "movie_theater", query: "theaters and cinemas", fallbackQuery: "cinemas" },
  { key: "airports", googleType: "airport", query: "international airports serving this destination", fallbackQuery: "international airports" },
];

const emptyGroups = () => Object.fromEntries(categories.map(({ key }) => [key, []])) as unknown as Record<Category, NormalizedPlace[]>;
const oneMonthAgo = () => Date.now() - 30 * 24 * 60 * 60 * 1000;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  websiteUri?: string;
  regularOpeningHours?: { periods?: OpeningPeriod[]; weekdayDescriptions?: string[] };
  businessStatus?: string;
  photos?: Array<{
    name?: string;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    publishTime?: string;
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }>;
};

const knownChainTokens = [
  "starbucks", "스타벅스", "mcdonald", "맥도날드", "burger king", "버거킹", "kfc", "subway", "서브웨이",
  "domino", "도미노", "pizza hut", "피자헛", "dunkin", "던킨", "krispy kreme", "크리스피크림", "tim hortons",
  "costa coffee", "coffee bean", "커피빈", "paris baguette", "파리바게뜨", "tous les jours", "뚜레쥬르",
  "mega coffee", "메가커피", "compose coffee", "컴포즈커피", "paik", "빽다방", "ediya", "이디야",
  "a twosome place", "투썸플레이스", "angel-in-us", "엔제리너스", "hollys", "할리스", "gong cha", "공차",
  "sulbing", "설빙", "baskin robbins", "배스킨라빈스", "lotteria", "롯데리아", "mom's touch", "맘스터치",
  "doutor", "ドトール", "tully's", "タリーズ", "komeda", "コメダ", "pret a manger", "shake shack",
];
const normalizeBrand = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const knownChainReason = (name: string, brand?: string | null) => {
  const normalized = normalizeBrand(`${name} ${brand || ""}`);
  const token = knownChainTokens.find(candidate => normalized.includes(normalizeBrand(candidate)));
  return token ? `known-chain:${token}` : null;
};
const cuisineFromTypes = (types: string[] = []) => {
  const cuisineType = types.find(type => type.endsWith("_restaurant") && !["restaurant", "fast_food_restaurant"].includes(type));
  return cuisineType?.replace(/_restaurant$/, "").replaceAll("_", " ") || null;
};
const internationalAirportName = (name: string) => /international|국제|国際|国际|quốc tế|internacional|internationale?/i.test(name);

const googleFieldMask = [
  "places.id", "places.displayName", "places.formattedAddress", "places.rating",
  "places.userRatingCount", "places.priceLevel", "places.primaryType", "places.location",
  "places.types", "places.googleMapsUri", "places.websiteUri", "places.reviews",
  "places.regularOpeningHours", "places.businessStatus", "places.photos",
].join(",");

const normalizeGooglePlace = (place: GooglePlace, key: Category, destination: string): NormalizedPlace | null => {
  if (!place.id || !place.displayName?.text || place.location?.latitude == null || place.location?.longitude == null || place.businessStatus === "CLOSED_PERMANENTLY") return null;
  const reviews: Review[] = (place.reviews || []).map(review => ({
    author: review.authorAttribution?.displayName || "Google user",
    rating: review.rating || 0,
    text: review.text?.text || review.originalText?.text || "",
    publishTime: review.publishTime || "",
    relativeTime: review.relativePublishTimeDescription || "",
  }));
  const chainReason = knownChainReason(place.displayName.text);
  const firstPhoto = place.photos?.[0];
  const firstAttribution = firstPhoto?.authorAttributions?.[0];
  return {
    id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress || destination,
    category: key,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount || 0,
    priceLevel: place.priceLevel || null,
    location: { latitude: place.location.latitude, longitude: place.location.longitude },
    googleMapsUri: place.googleMapsUri || null,
    photoName: firstPhoto?.name || null,
    photoAttribution: firstAttribution?.displayName ? {
      displayName: firstAttribution.displayName,
      uri: firstAttribution.uri || null,
    } : null,
    reviews,
    recentReviewCount: reviews.filter(review => review.publishTime && new Date(review.publishTime).getTime() >= oneMonthAgo()).length,
    source: "Google Places",
    originalName: null,
    translationStatus: "localized",
    types: place.types || [],
    primaryType: place.primaryType || null,
    cuisine: cuisineFromTypes(place.types),
    regularOpeningHours: place.regularOpeningHours ? {
      periods: place.regularOpeningHours.periods || [],
      weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || [],
    } : null,
    businessStatus: place.businessStatus || null,
    websiteUri: place.websiteUri || null,
    isLikelyChain: Boolean(chainReason),
    chainReason,
    trendScore: 0,
    trendMentions: 0,
    isInternationalAirport: key === "airports" && (
      (place.types || []).includes("international_airport")
      || place.primaryType === "international_airport"
      || internationalAirportName(place.displayName.text)
    ),
  };
};

const validBounds = (bounds: Bounds | null, lat: number, lng: number): Bounds => {
  if (bounds && [bounds.south, bounds.west, bounds.north, bounds.east].every(Number.isFinite) && bounds.north > bounds.south && bounds.east > bounds.west) {
    const latSpan = Math.min(bounds.north - bounds.south, 1.2);
    const lngSpan = Math.min(bounds.east - bounds.west, 1.5);
    return {
      south: Math.max(-90, lat - latSpan / 2),
      north: Math.min(90, lat + latSpan / 2),
      west: Math.max(-180, lng - lngSpan / 2),
      east: Math.min(180, lng + lngSpan / 2),
    };
  }
  const latitudeOffset = 0.22;
  const longitudeOffset = 0.28 / Math.max(Math.cos(lat * Math.PI / 180), .35);
  return { south: lat - latitudeOffset, north: lat + latitudeOffset, west: lng - longitudeOffset, east: lng + longitudeOffset };
};

const regionCenters = (bounds: Bounds) => {
  const latitudeSpan = bounds.north - bounds.south;
  const longitudeSpan = bounds.east - bounds.west;
  return [
    { latitude: bounds.south + latitudeSpan * .25, longitude: bounds.west + longitudeSpan * .25 },
    { latitude: bounds.south + latitudeSpan * .25, longitude: bounds.west + longitudeSpan * .75 },
    { latitude: bounds.south + latitudeSpan * .75, longitude: bounds.west + longitudeSpan * .25 },
    { latitude: bounds.south + latitudeSpan * .75, longitude: bounds.west + longitudeSpan * .75 },
  ];
};

const approximateZoneRadius = (bounds: Bounds) => {
  const latitudeKm = (bounds.north - bounds.south) * 111;
  const longitudeKm = (bounds.east - bounds.west) * 88;
  return Math.max(4000, Math.min(18000, Math.hypot(latitudeKm, longitudeKm) * 1000 * .32));
};

async function searchGoogle(destination: string, country: string, countryCode: string, languageCode: string, apiKey: string, lat: number, lng: number, requestedBounds: Bounds | null) {
  const groups = emptyGroups();
  const bounds = validBounds(requestedBounds, lat, lng);
  await Promise.all(categories.map(async ({ key, googleType, query }) => {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": googleFieldMask,
      },
      body: JSON.stringify({
        textQuery: key === "airports" ? `international airports in ${country || destination}` : `${destination} ${query}`,
        includedType: googleType,
        strictTypeFiltering: !["shopping", "theaters", "attractions", "restaurants"].includes(key),
        languageCode,
        ...(key === "airports" && countryCode ? { regionCode: countryCode.toLowerCase() } : {}),
        pageSize: 20,
        minRating: 3.5,
        rankPreference: "RELEVANCE",
        ...(key === "airports" ? {} : {
          locationRestriction: {
            rectangle: {
              low: { latitude: bounds.south, longitude: bounds.west },
              high: { latitude: bounds.north, longitude: bounds.east },
            },
          },
        }),
      }),
    });
    if (!response.ok) return;
    const data = await response.json() as { places?: GooglePlace[] };
    groups[key] = (data.places || []).map(place => normalizeGooglePlace(place, key, destination)).filter((place): place is NormalizedPlace => Boolean(place));
    if (key === "airports") groups[key] = groups[key].filter(place => place.isInternationalAirport);
  }));

  const localCategories = categories.filter(category => ["restaurants", "cafes", "hotels"].includes(category.key));
  const zoneRadius = approximateZoneRadius(bounds);
  const zoneResults = await Promise.all(localCategories.flatMap(({ key, googleType }) => regionCenters(bounds).map(async center => {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": googleFieldMask,
      },
      body: JSON.stringify({
        includedTypes: [googleType],
        maxResultCount: 10,
        languageCode,
        rankPreference: "POPULARITY",
        locationRestriction: { circle: { center, radius: zoneRadius } },
      }),
    });
    if (!response.ok) return { key, places: [] as NormalizedPlace[] };
    const data = await response.json() as { places?: GooglePlace[] };
    return {
      key,
      places: (data.places || []).map(place => normalizeGooglePlace(place, key, destination)).filter((place): place is NormalizedPlace => Boolean(place)),
    };
  })));
  for (const result of zoneResults) {
    const merged = [...groups[result.key], ...result.places];
    groups[result.key] = [...new Map(merged.map(place => [place.id, place])).values()];
  }

  for (const key of ["restaurants", "cafes", "hotels"] as const) {
    const nameCounts = new Map<string, number>();
    const domainCounts = new Map<string, number>();
    for (const place of groups[key]) {
      const normalizedName = normalizeBrand(place.name);
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
      if (place.websiteUri) {
        try {
          const domain = new URL(place.websiteUri).hostname.replace(/^www\./, "");
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        } catch { /* malformed provider URL */ }
      }
    }
    groups[key] = groups[key].map(place => {
      const repeatedName = (nameCounts.get(normalizeBrand(place.name)) || 0) > 1;
      let repeatedDomain = false;
      if (place.websiteUri) {
        try { repeatedDomain = (domainCounts.get(new URL(place.websiteUri).hostname.replace(/^www\./, "")) || 0) > 1; } catch { /* ignore */ }
      }
      const chainReason = place.chainReason || (repeatedName ? "repeated-brand-name" : repeatedDomain ? "repeated-brand-domain" : null);
      return { ...place, isLikelyChain: Boolean(chainReason), chainReason };
    });
  }
  return groups;
}

type NominatimResult = {
  place_id: number; osm_type: string; osm_id: number; lat: string; lon: string; name?: string; display_name: string;
  namedetails?: Record<string, string>;
  type?: string;
  category?: string;
  extratags?: Record<string, string>;
};
type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};
const instagramTrendCache = new Map<string, { expires: number; signals: InstagramSignal[]; hashtags: string[] }>();

async function fetchInstagramSignals(destination: string, accessToken: string, userId: string, apiVersion: string) {
  const region = destination.split(",")[0].trim();
  const compact = region.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");
  const hasKorean = /[\u3131-\uD79D]/.test(compact);
  const hashtags = (hasKorean ? [`${compact}맛집`, `${compact}카페`, `${compact}여행`] : [`${compact}food`, `${compact}cafe`, `${compact}travel`]).filter(tag => tag.length > 2);
  const cacheKey = `${apiVersion}:${userId}:${hashtags.join("|").toLowerCase()}`;
  const cached = instagramTrendCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached;
  const signals: InstagramSignal[] = [];
  for (const hashtag of hashtags) {
    const searchUrl = new URL(`https://graph.facebook.com/${apiVersion}/ig_hashtag_search`);
    searchUrl.searchParams.set("user_id", userId);
    searchUrl.searchParams.set("q", hashtag);
    const searchResponse = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!searchResponse.ok) continue;
    const searchData = await searchResponse.json() as { data?: Array<{ id?: string }> };
    const hashtagId = searchData.data?.[0]?.id;
    if (!hashtagId) continue;
    const mediaUrl = new URL(`https://graph.facebook.com/${apiVersion}/${hashtagId}/top_media`);
    mediaUrl.searchParams.set("user_id", userId);
    mediaUrl.searchParams.set("fields", "caption,comments_count,like_count,permalink,timestamp");
    mediaUrl.searchParams.set("limit", "25");
    const mediaResponse = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!mediaResponse.ok) continue;
    const mediaData = await mediaResponse.json() as { data?: Array<{ caption?: string; comments_count?: number; like_count?: number; permalink?: string; timestamp?: string }> };
    for (const media of mediaData.data || []) {
      if (!media.caption) continue;
      signals.push({
        caption: media.caption,
        engagement: (media.like_count || 0) + (media.comments_count || 0) * 3,
        permalink: media.permalink || "",
        timestamp: media.timestamp || "",
      });
    }
  }
  const result = { expires: Date.now() + 6 * 60 * 60 * 1000, signals, hashtags };
  instagramTrendCache.set(cacheKey, result);
  return result;
}

function applyInstagramSignals(groups: Record<Category, NormalizedPlace[]>, signals: InstagramSignal[]) {
  if (!signals.length) return groups;
  const normalizedCaptions = signals.map(signal => ({ ...signal, normalized: normalizeBrand(signal.caption) }));
  for (const category of categories) {
    groups[category.key] = groups[category.key].map(place => {
      const placeName = normalizeBrand(place.name);
      if (placeName.length < 4) return place;
      const matches = normalizedCaptions.filter(signal => signal.normalized.includes(placeName));
      return {
        ...place,
        trendMentions: matches.length,
        trendScore: matches.reduce((sum, signal) => sum + Math.log10(signal.engagement + 10), 0),
      };
    });
  }
  return groups;
}

const diverseSlice = (places: NormalizedPlace[], bounds: Bounds, limit: number) => {
  const latitudeSpan = Math.max(bounds.north - bounds.south, .001);
  const longitudeSpan = Math.max(bounds.east - bounds.west, .001);
  const buckets = new Map<string, NormalizedPlace[]>();
  for (const place of places) {
    const row = Math.min(3, Math.max(0, Math.floor((place.location.latitude - bounds.south) / latitudeSpan * 4)));
    const column = Math.min(3, Math.max(0, Math.floor((place.location.longitude - bounds.west) / longitudeSpan * 4)));
    const key = `${row}:${column}`;
    buckets.set(key, [...(buckets.get(key) || []), place]);
  }
  const result: NormalizedPlace[] = [];
  let index = 0;
  const bucketValues = [...buckets.values()];
  while (result.length < limit && bucketValues.some(bucket => index < bucket.length)) {
    for (const bucket of bucketValues) {
      if (bucket[index]) result.push(bucket[index]);
      if (result.length >= limit) break;
    }
    index += 1;
  }
  return result;
};

async function searchOverpass(destination: string, languageCode: string, bounds: Bounds) {
  const query = `[out:json][timeout:20];(
    nwr["amenity"="restaurant"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    nwr["amenity"="cafe"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    nwr["tourism"="hotel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    nwr["tourism"~"attraction|museum|gallery"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    nwr["leisure"="park"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    nwr["aeroway"="aerodrome"](${bounds.south - 1},${bounds.west - 1},${bounds.north + 1},${bounds.east + 1});
  );out center 600;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LOCI-Travel-Planner/1.0" },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) return emptyGroups();
  const data = await response.json() as { elements?: OverpassElement[] };
  const groups = emptyGroups();
  for (const element of data.elements || []) {
    const tags = element.tags || {};
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const name = tags[`name:${languageCode}`] || tags.name;
    if (!name || latitude == null || longitude == null) continue;
    const category: Category | null = tags.amenity === "restaurant" ? "restaurants"
      : tags.amenity === "cafe" ? "cafes"
        : tags.tourism === "hotel" ? "hotels"
          : ["museum", "gallery"].includes(tags.tourism) ? "museums"
            : tags.tourism === "attraction" ? "attractions"
              : tags.leisure === "park" ? "parks"
                : tags.aeroway === "aerodrome" ? "airports"
                : null;
    if (!category) continue;
    const chainReason = knownChainReason(name, tags.brand || tags.operator);
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" ") || destination;
    groups[category].push({
      id: `osm-${element.type}-${element.id}`,
      name,
      address,
      category,
      rating: null,
      userRatingCount: 0,
      priceLevel: null,
      location: { latitude, longitude },
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      photoName: null,
      photoAttribution: null,
      reviews: [],
      recentReviewCount: 0,
      source: "OpenStreetMap",
      originalName: name === tags.name ? null : tags.name || null,
      translationStatus: tags[`name:${languageCode}`] ? "localized" : "source-language",
      types: [tags.amenity, tags.tourism, tags.leisure, tags.aeroway].filter((value): value is string => Boolean(value)),
      primaryType: tags.amenity || tags.tourism || tags.leisure || tags.aeroway || null,
      cuisine: tags.cuisine?.replaceAll(";", ", ") || null,
      regularOpeningHours: null,
      businessStatus: null,
      websiteUri: tags.website || null,
      isLikelyChain: Boolean(chainReason),
      chainReason,
      trendScore: 0,
      trendMentions: 0,
      isInternationalAirport: category === "airports" && (
        tags["aerodrome:type"] === "international"
        || tags.international === "yes"
        || internationalAirportName(name)
      ),
    });
  }
  for (const category of categories) groups[category.key] = diverseSlice(groups[category.key], bounds, 24);
  return groups;
}

const fallbackCache = new Map<string, { expires: number; groups: Record<Category, NormalizedPlace[]> }>();

async function searchNominatim(destination: string, languageCode: string, bounds: Bounds) {
  const cacheKey = `${languageCode}:${destination.toLowerCase()}:${bounds.south.toFixed(3)}:${bounds.west.toFixed(3)}:${bounds.north.toFixed(3)}:${bounds.east.toFixed(3)}`;
  const cached = fallbackCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.groups;
  const groups = emptyGroups();
  for (const { key, fallbackQuery } of categories) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${fallbackQuery} in ${destination}`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("limit", "12");
    const response = await fetch(url, { headers: { "User-Agent": "LOCI-Travel-Planner/1.0", "Accept-Language": languageCode } });
    if (response.ok) {
      const results = await response.json() as NominatimResult[];
      const seen = new Set<string>();
      groups[key] = results.filter(result => {
        const dedupeKey = `${result.name}-${Number(result.lat).toFixed(4)}-${Number(result.lon).toFixed(4)}`;
        if (!result.name || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon)) || seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      }).slice(0, 12).map(result => {
        const languageName = result.namedetails?.[`name:${languageCode}`];
        const localizedName = languageName || result.name!;
        const chainReason = knownChainReason(localizedName, result.extratags?.brand || result.extratags?.operator);
        return {
          id: `osm-${result.osm_type}-${result.osm_id}`,
          name: localizedName,
          address: result.display_name,
          category: key,
          rating: null,
          userRatingCount: 0,
          priceLevel: null,
          location: { latitude: Number(result.lat), longitude: Number(result.lon) },
          googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`,
          photoName: null,
          photoAttribution: null,
          reviews: [],
          recentReviewCount: 0,
          source: "OpenStreetMap" as const,
          originalName: localizedName === result.name ? null : result.name!,
          translationStatus: languageName ? "localized" as const : "source-language" as const,
          types: [result.category, result.type].filter((value): value is string => Boolean(value)),
          primaryType: result.type || null,
          cuisine: result.extratags?.cuisine?.replaceAll(";", ", ") || null,
          regularOpeningHours: null,
          businessStatus: null,
          websiteUri: result.extratags?.website || null,
          isLikelyChain: Boolean(chainReason),
          chainReason,
          trendScore: 0,
          trendMentions: 0,
          isInternationalAirport: key === "airports" && (
            result.type === "international_airport"
            || result.extratags?.["aerodrome:type"] === "international"
            || result.extratags?.international === "yes"
            || internationalAirportName(localizedName)
          ),
        };
      });
    }
    if (key !== categories.at(-1)?.key) await new Promise(resolve => setTimeout(resolve, 1050));
  }
  try {
    const overpassGroups = await searchOverpass(destination, languageCode, bounds);
    for (const category of categories) {
      const merged = [...groups[category.key], ...overpassGroups[category.key]];
      groups[category.key] = diverseSlice([...new Map(merged.map(place => [place.id, place])).values()], bounds, 24);
    }
  } catch { /* keep the Nominatim results */ }
  fallbackCache.set(cacheKey, { expires: Date.now() + 60 * 60 * 1000, groups });
  return groups;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = url.searchParams.get("destination")?.trim() || url.searchParams.get("q")?.trim();
  const country = url.searchParams.get("country")?.trim() || "";
  const countryCode = url.searchParams.get("countryCode")?.trim() || "";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const requestedBounds = ["south", "west", "north", "east"].every(key => Number.isFinite(Number(url.searchParams.get(key)))) ? {
    south: Number(url.searchParams.get("south")),
    west: Number(url.searchParams.get("west")),
    north: Number(url.searchParams.get("north")),
    east: Number(url.searchParams.get("east")),
  } : null;
  const languageCode = ({ KR: "ko", EN: "en", ZH: "zh-CN", JA: "ja", VI: "vi" } as Record<string, string>)[url.searchParams.get("lang") || "KR"] || "en";
  if (!destination) return Response.json({ error: "Missing destination" }, { status: 400 });
  const bindings = env as typeof env & {
    GOOGLE_MAPS_API_KEY?: string;
    INSTAGRAM_ACCESS_TOKEN?: string;
    INSTAGRAM_USER_ID?: string;
    INSTAGRAM_GRAPH_API_VERSION?: string;
  };

  try {
    if (bindings.GOOGLE_MAPS_API_KEY) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return Response.json({ groups: emptyGroups(), source: "unavailable", error: "Coordinates are required for regional place search." }, { status: 400 });
      }
      const groups = await searchGoogle(destination, country, countryCode, languageCode, bindings.GOOGLE_MAPS_API_KEY, lat, lng, requestedBounds);
      let trendSource: string | null = null;
      let trendHashtags: string[] = [];
      if (bindings.INSTAGRAM_ACCESS_TOKEN && bindings.INSTAGRAM_USER_ID) {
        try {
          const trend = await fetchInstagramSignals(destination, bindings.INSTAGRAM_ACCESS_TOKEN, bindings.INSTAGRAM_USER_ID, bindings.INSTAGRAM_GRAPH_API_VERSION || "v23.0");
          applyInstagramSignals(groups, trend.signals);
          trendSource = trend.signals.length ? "Instagram Graph API" : null;
          trendHashtags = trend.hashtags;
        } catch { /* keep map recommendations without a social signal */ }
      }
      return Response.json({
        groups,
        source: "Google Places",
        trendSource,
        trendHashtags,
        reviewWindowDays: 30,
        recommendationPolicy: "Region-wide multi-zone discovery with likely-chain suppression for restaurants and cafes.",
        notice: trendSource
          ? "Google Places data is combined with official Instagram hashtag-media mentions. Instagram popularity is shown only for exact venue-name matches."
          : "Region-wide Google Places discovery is active. Instagram trend scoring requires an approved professional-account Graph API connection.",
      });
    }
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const bounds = validBounds(requestedBounds, lat, lng);
      const groups = await searchNominatim(destination, languageCode, bounds);
      let trendSource: string | null = null;
      let trendHashtags: string[] = [];
      if (bindings.INSTAGRAM_ACCESS_TOKEN && bindings.INSTAGRAM_USER_ID) {
        try {
          const trend = await fetchInstagramSignals(destination, bindings.INSTAGRAM_ACCESS_TOKEN, bindings.INSTAGRAM_USER_ID, bindings.INSTAGRAM_GRAPH_API_VERSION || "v23.0");
          applyInstagramSignals(groups, trend.signals);
          trendSource = trend.signals.length ? "Instagram Graph API" : null;
          trendHashtags = trend.hashtags;
        } catch { /* keep map recommendations without a social signal */ }
      }
      return Response.json({
        groups,
        source: "OpenStreetMap",
        trendSource,
        trendHashtags,
        reviewWindowDays: 30,
        recommendationPolicy: "Region-wide spatial sampling with likely-chain suppression for restaurants and cafes.",
        notice: trendSource
          ? "OpenStreetMap region-wide discovery is combined with official Instagram hashtag-media mentions."
          : "OpenStreetMap region-wide discovery is active. Ratings, reviews, and Instagram trend scoring require their approved API connections.",
      });
    }
  } catch {
    return Response.json({ groups: emptyGroups(), source: "unavailable", error: "Place data is temporarily unavailable." }, { status: 503 });
  }
  return Response.json({ groups: emptyGroups(), source: "unavailable", error: "Coordinates are required." }, { status: 400 });
}
