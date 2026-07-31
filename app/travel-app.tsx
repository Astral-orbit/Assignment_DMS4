"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LocationMap, WorldCommunityMap } from "./world-maps";

type Lang = "KR" | "EN" | "ZH" | "JA" | "VI";
type Screen = "onboarding" | "plan" | "explore" | "route" | "community" | "profile";
type Localized = { ko: string; en: string };
type Bounds = { south: number; west: number; north: number; east: number };
type Trip = {
  destination: string; accommodation: string; people: number; dates: string; purpose: string; styles: string[];
  coords?: [number, number]; resolvedName?: string; country?: string; countryCode?: string; source?: string;
  bounds?: Bounds;
  accommodationCoords?: [number, number]; accommodationResolvedName?: string;
};
type Place = { id: string; name: Localized; area: Localized; type: Localized; tip: Localized; tags: Localized[]; rating: number; cost: string; crowd: number; time: string; color: string };
type Profile = { city: Localized; country: string; countryCode: string; coords: [number, number]; currency: string; places: Place[]; known?: boolean };
type Review = { id: number; author: string; rating: number; content: string; createdAt?: string };
type Post = { id: number; author: string; title: string; content: string; likes: number; region: string; createdAt?: string };
type CategoryKey = "attractions" | "restaurants" | "cafes" | "museums" | "hotels" | "parks" | "shopping" | "theaters" | "airports";
type PlanKey = "A" | "B" | "C";
type GoogleReview = { author: string; rating: number; text: string; publishTime: string; relativeTime: string };
type OpeningPeriod = { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } };
type LivePlace = {
  id: string; name: string; address: string; category: CategoryKey; rating: number | null; userRatingCount: number;
  priceLevel: string | null; location: { latitude: number; longitude: number }; googleMapsUri: string | null;
  photoName: string | null; photoAttribution: { displayName: string; uri: string | null } | null;
  reviews: GoogleReview[]; recentReviewCount: number; source: "Google Places" | "OpenStreetMap" | "User accommodation";
  originalName?: string | null; translationStatus?: "localized" | "source-language";
  types: string[]; primaryType: string | null; cuisine: string | null;
  regularOpeningHours: { periods: OpeningPeriod[]; weekdayDescriptions: string[] } | null;
  businessStatus: string | null;
  websiteUri: string | null;
  isLikelyChain: boolean;
  chainReason: string | null;
  trendScore: number;
  trendMentions: number;
  isInternationalAirport: boolean;
};
type ItineraryStop = LivePlace & { scheduledTime: string; role: Localized; hoursChecked: boolean; accommodationStop?: boolean };
type PlaceGroups = Record<CategoryKey, LivePlace[]>;
type RouteData = {
  source: string; transitAvailable: boolean; geometry: Array<[number, number]>;
  legs: Array<{ from: string; to: string; durationSeconds: number; distanceMeters: number; fare: string | null; transfers: number; steps: Array<{ mode: string; instruction: string; line: string; stops: number }> }>;
  totalDurationSeconds: number; totalDistanceMeters: number; totalTransfers: number | null; totalFare: string | null; error?: string;
};
type WeatherData = {
  temp: number; feels: number; condition: string; source: string;
  humidity: number | null; precipitationProbability: number | null; precipitationAmount: number | null;
  windSpeed: number | null; windGust: number | null; windDirection: string | number | null;
  uvIndex: number | null; visibility: number | null; cloudCover: number | null; observedAt: string | null;
  high: number | null; low: number | null; localDate: string | null; timeZone: string | null;
};
type RegionOption = { id: string; name: string; originalName: string | null; adminLevel: number; latitude: number | null; longitude: number | null };
type SavedPlan = {
  id: string; savedAt: string; plan: PlanKey; destination: string; country: string; dates: string; people: number;
  accommodation: string; styles: string[]; source: string; stops: Array<{
    id: string; name: string; address: string; scheduledTime: string; role: Localized;
    category: CategoryKey; rating: number | null; latitude: number; longitude: number;
  }>;
  totalDistanceMeters: number; totalDurationSeconds: number; totalTransfers: number | null; totalFare: string | null;
};

const phraseTranslations: Record<Exclude<Lang, "KR" | "EN">, Record<string, string>> = {
  ZH: {
    "Local food": "当地美食", "Slow pace": "悠闲行程", "Culture & art": "文化艺术", Nature: "自然", Nightlife: "夜间活动", Shopping: "购物", "Theme parks": "主题乐园", "Food tour": "美食之旅", "Bars & pubs": "酒吧与酒馆", "Exotic & unusual": "异国与特色体验", "Visit as many places as possible": "尽可能多地游览", Photography: "摄影", "History & heritage": "历史文化", Wellness: "疗愈与休闲", "Budget-friendly": "高性价比",
    Attractions: "景点", Restaurants: "餐厅", Cafés: "咖啡馆", "Museums & galleries": "博物馆与美术馆", Hotels: "酒店", Parks: "公园", "Department stores & malls": "百货与购物中心", Theaters: "剧院与影院", Airports: "机场",
    Breakfast: "早餐", "Morning culture visit": "上午文化参观", Lunch: "午餐", "Highly rated local café": "高评分当地咖啡馆", "Afternoon exhibition or sight": "下午展览或景点", Dinner: "晚餐", "Evening visit": "夜间游览", "Return to accommodation": "返回住宿", "Morning discovery 1": "上午探索 1", "Morning discovery 2": "上午探索 2", "Afternoon discovery 1": "下午探索 1", "Afternoon discovery 2": "下午探索 2", "Afternoon discovery 3": "下午探索 3", "Afternoon discovery 4": "下午探索 4", "Evening discovery 1": "晚间探索 1", "Evening discovery 2": "晚间探索 2", "Relaxed morning visit": "悠闲上午行程", "Relaxed afternoon visit": "悠闲下午行程",
  },
  JA: {
    "Local food": "ローカルグルメ", "Slow pace": "ゆったり旅", "Culture & art": "文化・芸術", Nature: "自然", Nightlife: "ナイトライフ", Shopping: "ショッピング", "Theme parks": "テーマパーク", "Food tour": "フードツアー", "Bars & pubs": "バー・パブ", "Exotic & unusual": "異国情緒・ユニーク", "Visit as many places as possible": "できるだけ多く訪問", Photography: "写真", "History & heritage": "歴史・遺産", Wellness: "ウェルネス", "Budget-friendly": "節約重視",
    Attractions: "観光スポット", Restaurants: "レストラン", Cafés: "カフェ", "Museums & galleries": "美術館・博物館", Hotels: "ホテル", Parks: "公園", "Department stores & malls": "百貨店・モール", Theaters: "劇場・映画館", Airports: "空港",
    Breakfast: "朝食", "Morning culture visit": "午前の文化訪問", Lunch: "昼食", "Highly rated local café": "高評価のローカルカフェ", "Afternoon exhibition or sight": "午後の展示・名所", Dinner: "夕食", "Evening visit": "夜の訪問", "Return to accommodation": "宿泊先へ戻る", "Morning discovery 1": "午前スポット 1", "Morning discovery 2": "午前スポット 2", "Afternoon discovery 1": "午後スポット 1", "Afternoon discovery 2": "午後スポット 2", "Afternoon discovery 3": "午後スポット 3", "Afternoon discovery 4": "午後スポット 4", "Evening discovery 1": "夜スポット 1", "Evening discovery 2": "夜スポット 2", "Relaxed morning visit": "ゆったり午前訪問", "Relaxed afternoon visit": "ゆったり午後訪問",
  },
  VI: {
    "Local food": "Ẩm thực địa phương", "Slow pace": "Lịch trình thư thả", "Culture & art": "Văn hóa & nghệ thuật", Nature: "Thiên nhiên", Nightlife: "Hoạt động buổi tối", Shopping: "Mua sắm", "Theme parks": "Công viên chủ đề", "Food tour": "Tour ẩm thực", "Bars & pubs": "Quán bar & pub", "Exotic & unusual": "Độc đáo & khác lạ", "Visit as many places as possible": "Thăm nhiều nơi nhất có thể", Photography: "Nhiếp ảnh", "History & heritage": "Lịch sử & di sản", Wellness: "Chăm sóc sức khỏe", "Budget-friendly": "Tiết kiệm chi phí",
    Attractions: "Điểm tham quan", Restaurants: "Nhà hàng", Cafés: "Quán cà phê", "Museums & galleries": "Bảo tàng & phòng tranh", Hotels: "Khách sạn", Parks: "Công viên", "Department stores & malls": "Trung tâm mua sắm", Theaters: "Nhà hát & rạp phim", Airports: "Sân bay",
    Breakfast: "Bữa sáng", "Morning culture visit": "Tham quan văn hóa buổi sáng", Lunch: "Bữa trưa", "Highly rated local café": "Quán cà phê địa phương được đánh giá cao", "Afternoon exhibition or sight": "Triển lãm hoặc điểm đến buổi chiều", Dinner: "Bữa tối", "Evening visit": "Điểm đến buổi tối", "Return to accommodation": "Trở về nơi lưu trú", "Morning discovery 1": "Khám phá sáng 1", "Morning discovery 2": "Khám phá sáng 2", "Afternoon discovery 1": "Khám phá chiều 1", "Afternoon discovery 2": "Khám phá chiều 2", "Afternoon discovery 3": "Khám phá chiều 3", "Afternoon discovery 4": "Khám phá chiều 4", "Evening discovery 1": "Khám phá tối 1", "Evening discovery 2": "Khám phá tối 2", "Relaxed morning visit": "Điểm đến buổi sáng thư thả", "Relaxed afternoon visit": "Điểm đến buổi chiều thư thả",
  },
};
const t = (lang: Lang, value: Localized) => lang === "KR" ? value.ko : lang === "EN" ? value.en : phraseTranslations[lang][value.en] || value.en;
const L = (ko: string, en: string): Localized => ({ ko, en });
const localeByLang: Record<Lang, string> = { KR: "ko-KR", EN: "en-US", ZH: "zh-CN", JA: "ja-JP", VI: "vi-VN" };
const languageOptions: Array<{ key: Lang; label: string }> = [
  { key: "KR", label: "한국어" },
  { key: "EN", label: "English" },
  { key: "ZH", label: "中文" },
  { key: "JA", label: "日本語" },
  { key: "VI", label: "Tiếng Việt" },
];
const pickCopy = (lang: Lang, values: Record<Lang, string>) => values[lang];
const styleLabels: Record<string, Localized> = {
  food: L("로컬 맛집", "Local food"),
  slow: L("느긋한 일정", "Slow pace"),
  culture: L("문화·예술", "Culture & art"),
  nature: L("자연", "Nature"),
  night: L("야간 활동", "Nightlife"),
  shopping: L("쇼핑", "Shopping"),
  themepark: L("테마파크", "Theme parks"),
  foodtour: L("음식 투어", "Food tour"),
  bars: L("술집·바", "Bars & pubs"),
  exotic: L("이색적·이국적", "Exotic & unusual"),
  maximize: L("최대한 많은 곳 방문", "Visit as many places as possible"),
  photo: L("사진 명소", "Photography"),
  history: L("역사·유산", "History & heritage"),
  wellness: L("휴식·웰니스", "Wellness"),
  budget: L("가성비 여행", "Budget-friendly"),
};
const categoryLabels: Record<CategoryKey, Localized> = {
  attractions: L("관광지", "Attractions"), restaurants: L("식당", "Restaurants"), cafes: L("카페", "Cafés"),
  museums: L("미술관·박물관", "Museums & galleries"), hotels: L("호텔", "Hotels"), parks: L("공원", "Parks"), shopping: L("백화점·쇼핑몰", "Shopping"),
  theaters: L("극장·영화관", "Theaters"),
  airports: L("공항", "Airports"),
};
const categoryKeys = Object.keys(categoryLabels) as CategoryKey[];
const emptyPlaceGroups = (): PlaceGroups => Object.fromEntries(categoryKeys.map(key => [key, []])) as unknown as PlaceGroups;
const formatDuration = (seconds: number, lang: Lang) => seconds ? `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}${lang === "KR" ? "시간 " : "h "}` : ""}${Math.round(seconds % 3600 / 60)}${lang === "KR" ? "분" : "m"}` : "—";
const formatDistance = (meters: number) => meters ? `${(meters / 1000).toFixed(1)} km` : "—";
const recentReviewCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const isRecentReview = (publishTime: string) => Boolean(publishTime && new Date(publishTime).getTime() >= recentReviewCutoff);
const routePoints = (stops: LivePlace[]) => stops.map(place => ({ name: place.name, latitude: place.location.latitude, longitude: place.location.longitude }));
const mapStops = (stops: LivePlace[]) => stops.map(place => ({ id: place.id, name: place.name, coordinates: [place.location.longitude, place.location.latitude] as [number, number], kind: place.category === "airports" ? "airport" as const : "stop" as const }));
const savedPlanId = (trip: Trip, plan: PlanKey) => [trip.destination, trip.dates, trip.accommodation, plan].map(value => value.trim().toLocaleLowerCase()).join("|");
const placePhotoUrl = (place: LivePlace) => place.photoName ? `/api/place-photo?name=${encodeURIComponent(place.photoName)}` : null;
function PlaceImage({ place }: { place: LivePlace }) {
  const photoUrl = placePhotoUrl(place);
  if (!photoUrl) return null;
  return <>
    {/* Dynamic Place Photo media URLs are proxied and do not have stable intrinsic dimensions. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="place-image" src={photoUrl} alt="" loading="lazy" />
    {place.photoAttribution && <a className="photo-credit" href={place.photoAttribution.uri || place.googleMapsUri || "#"} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{place.photoAttribution.displayName}</a>}
  </>;
}
const toRadians = (degrees: number) => degrees * Math.PI / 180;
const distanceKm = (a: LivePlace, b: LivePlace) => {
  const latitudeDelta = toRadians(b.location.latitude - a.location.latitude);
  const longitudeDelta = toRadians(b.location.longitude - a.location.longitude);
  const latitudeA = toRadians(a.location.latitude);
  const latitudeB = toRadians(b.location.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const tripWeekday = (dates: string) => {
  const date = dates.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return date ? new Date(`${date}T12:00:00Z`).getUTCDay() : new Date().getDay();
};
const isOpenAt = (place: LivePlace, time: string, weekday: number) => {
  const periods = place.regularOpeningHours?.periods || [];
  if (!periods.length) return null;
  const [hour, minute] = time.split(":").map(Number);
  const target = weekday * 1440 + hour * 60 + minute;
  return periods.some(period => {
    if (period.open?.day == null) return false;
    const open = period.open.day * 1440 + (period.open.hour || 0) * 60 + (period.open.minute || 0);
    if (!period.close || period.close.day == null) return target >= open;
    let close = period.close.day * 1440 + (period.close.hour || 0) * 60 + (period.close.minute || 0);
    if (close <= open) close += 7 * 1440;
    const normalizedTarget = target < open && close > 7 * 1440 ? target + 7 * 1440 : target;
    return normalizedTarget >= open && normalizedTarget < close;
  });
};
const cuisineKey = (place: LivePlace) => place.cuisine?.split(",")[0]?.trim().toLowerCase()
  || place.types.find(type => type.endsWith("_restaurant") && type !== "restaurant")?.replace(/_restaurant$/, "")
  || `unknown:${place.id}`;
const qualityScore = (place: LivePlace) => (place.rating ?? 3.5) * 2
  + Math.log10(place.userRatingCount + 1)
  + Math.min(place.recentReviewCount, 5) * .2
  + Math.min(place.trendScore, 6) * .7;
const styleMatchScore = (place: LivePlace, styles: string[]) => {
  const types = new Set([place.category, place.primaryType, ...place.types].filter(Boolean));
  let score = 0;
  if (styles.includes("food") || styles.includes("foodtour")) score += ["restaurants", "cafes"].includes(place.category) ? 3 : 0;
  if (styles.includes("culture")) score += place.category === "museums" ? 5 : place.category === "attractions" ? 2 : 0;
  if (styles.includes("nature") || styles.includes("wellness")) score += place.category === "parks" ? 5 : 0;
  if (styles.includes("night")) score += ["theaters", "shopping"].includes(place.category) ? 4 : 0;
  if (styles.includes("shopping")) score += place.category === "shopping" ? 6 : 0;
  if (styles.includes("themepark")) score += types.has("amusement_park") || types.has("theme_park") ? 10 : place.category === "attractions" ? 2 : 0;
  if (styles.includes("bars")) score += types.has("bar") || types.has("pub") || types.has("night_club") ? 10 : place.category === "restaurants" ? 1 : 0;
  if (styles.includes("photo")) score += ["attractions", "parks"].includes(place.category) ? 4 : 0;
  if (styles.includes("history")) score += place.category === "museums" || types.has("historical_landmark") ? 6 : 0;
  if (styles.includes("budget")) score += ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE"].includes(place.priceLevel || "") ? 4 : 0;
  if (styles.includes("exotic")) score += place.isLikelyChain ? -5 : 2 + Math.min(place.trendScore, 5);
  return score;
};
const accommodationPlace = (trip: Trip): LivePlace | null => trip.accommodationCoords ? {
  id: "user-accommodation",
  name: trip.accommodationResolvedName || trip.accommodation,
  address: trip.accommodationResolvedName || trip.accommodation,
  category: "hotels",
  rating: null,
  userRatingCount: 0,
  priceLevel: null,
  location: { latitude: trip.accommodationCoords[1], longitude: trip.accommodationCoords[0] },
  googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${trip.accommodationCoords[1]},${trip.accommodationCoords[0]}`,
  photoName: null,
  photoAttribution: null,
  reviews: [],
  recentReviewCount: 0,
  source: "User accommodation",
  originalName: null,
  translationStatus: "localized",
  types: ["lodging"],
  primaryType: "lodging",
  cuisine: null,
  regularOpeningHours: null,
  businessStatus: null,
  websiteUri: null,
  isLikelyChain: false,
  chainReason: null,
  trendScore: 0,
  trendMentions: 0,
  isInternationalAirport: false,
} : null;

function buildItinerary(groups: PlaceGroups, trip: Trip, plan: PlanKey) {
  const variant = plan === "A" ? 0 : plan === "B" ? 1 : 2;
  const weekday = tripWeekday(trip.dates);
  const slowPace = trip.styles.includes("slow") && !trip.styles.includes("maximize");
  const maximizeStops = trip.styles.includes("maximize");
  const slowDistanceLimitKm = 2;
  const used = new Set<string>();
  const cuisines = new Set<string>();
  const accommodation = accommodationPlace(trip);
  let current = accommodation;
  let travelledKm = 0;
  const visits: ItineraryStop[] = [];
  const regionalCandidates = [...groups.attractions, ...groups.museums, ...groups.parks, ...groups.restaurants, ...groups.cafes]
    .filter(place => !place.isLikelyChain)
    .filter(place => !accommodation || distanceKm(accommodation, place) <= 45)
    .sort((a, b) => {
      const scoreA = qualityScore(a) + styleMatchScore(a, trip.styles) + (accommodation ? Math.min(distanceKm(accommodation, a), 20) * .18 : 0);
      const scoreB = qualityScore(b) + styleMatchScore(b, trip.styles) + (accommodation ? Math.min(distanceKm(accommodation, b), 20) * .18 : 0);
      return scoreB - scoreA;
    });
  const regionalAnchors: LivePlace[] = [];
  for (const candidate of regionalCandidates) {
    if (regionalAnchors.every(anchor => distanceKm(anchor, candidate) >= 4)) regionalAnchors.push(candidate);
    if (regionalAnchors.length >= 3) break;
  }
  const dayAnchor = regionalAnchors[Math.min(variant, regionalAnchors.length - 1)] || regionalCandidates[variant] || null;

  const pick = (candidates: LivePlace[], time: string, role: Localized, options: { avoidCuisine?: boolean; exclude?: CategoryKey[]; returnBias?: boolean; zoneBias?: boolean } = {}) => {
    const available = candidates
      .filter(place => !used.has(place.id) && !options.exclude?.includes(place.category) && isOpenAt(place, time, weekday) !== false)
      .filter(place => {
        if (!slowPace || !accommodation || !current) return true;
        const nextDistance = distanceKm(current, place);
        const returnDistance = distanceKm(place, accommodation);
        return travelledKm + nextDistance + returnDistance <= slowDistanceLimitKm;
      });
    const localFirst = available.some(place => !place.isLikelyChain) ? available.filter(place => !place.isLikelyChain) : available;
    const cuisineFiltered = options.avoidCuisine ? localFirst.filter(place => !cuisines.has(cuisineKey(place))) : localFirst;
    const pool = cuisineFiltered.length ? cuisineFiltered : localFirst;
    const ranked = pool.map(place => ({
      place,
      score: qualityScore(place)
        + styleMatchScore(place, trip.styles)
        + (place.isLikelyChain ? -12 : 1.2)
        - (current ? distanceKm(current, place) * .55 : 0)
        - (options.zoneBias && dayAnchor ? distanceKm(place, dayAnchor) * .28 : 0)
        - (options.returnBias && accommodation ? distanceKm(place, accommodation) * .35 : 0),
    })).sort((a, b) => b.score - a.score);
    const choice = ranked.length ? ranked[Math.min(variant, ranked.length - 1)].place : null;
    if (!choice) return;
    if (current) travelledKm += distanceKm(current, choice);
    used.add(choice.id);
    if (options.avoidCuisine) cuisines.add(cuisineKey(choice));
    visits.push({ ...choice, scheduledTime: time, role, hoursChecked: isOpenAt(choice, time, weekday) !== null });
    current = choice;
  };

  const prioritize = (candidates: LivePlace[], predicate: (place: LivePlace) => boolean) => [
    ...candidates.filter(predicate),
    ...candidates.filter(place => !predicate(place)),
  ];
  const cultureAndSights = [...groups.museums, ...groups.attractions, ...groups.parks];
  const morningCandidates = trip.styles.includes("themepark")
    ? prioritize(cultureAndSights, place => place.types.some(type => type === "amusement_park" || type === "theme_park"))
    : trip.styles.includes("nature") || trip.styles.includes("wellness")
      ? prioritize(cultureAndSights, place => place.category === "parks")
      : trip.styles.includes("history") || trip.styles.includes("culture")
        ? prioritize(cultureAndSights, place => place.category === "museums" || place.types.includes("historical_landmark"))
        : cultureAndSights;
  const afternoonCandidates = trip.styles.includes("foodtour")
    ? [...groups.cafes, ...groups.restaurants, ...cultureAndSights]
    : trip.styles.includes("shopping")
      ? [...groups.shopping, ...groups.cafes, ...cultureAndSights]
      : [...groups.cafes, ...cultureAndSights, ...groups.shopping];
  const barCandidates = groups.restaurants.filter(place => place.types.some(type => type === "bar" || type === "pub" || type === "night_club"));
  const eveningCandidates = trip.styles.includes("bars")
    ? [...barCandidates, ...groups.theaters, ...groups.shopping, ...groups.attractions]
    : [...groups.theaters, ...groups.shopping, ...groups.attractions, ...groups.restaurants];

  pick(groups.restaurants, "08:00", L("아침 식사", "Breakfast"), { avoidCuisine: true });
  if (maximizeStops) {
    pick(morningCandidates, "09:00", L("오전 탐방 1", "Morning discovery 1"), { zoneBias: true });
    pick(morningCandidates, "10:20", L("오전 탐방 2", "Morning discovery 2"), { zoneBias: true });
    pick(groups.restaurants, "12:00", L("점심 식사", "Lunch"), { avoidCuisine: true, zoneBias: true });
    pick(afternoonCandidates, "13:15", L("오후 탐방 1", "Afternoon discovery 1"), { zoneBias: true });
    pick(afternoonCandidates, "14:30", L("오후 탐방 2", "Afternoon discovery 2"), { zoneBias: true });
    pick(afternoonCandidates, "15:45", L("오후 탐방 3", "Afternoon discovery 3"), { zoneBias: true });
    pick(afternoonCandidates, "17:00", L("오후 탐방 4", "Afternoon discovery 4"), { zoneBias: true });
    pick(groups.restaurants, "18:00", L("저녁 식사", "Dinner"), { avoidCuisine: true, zoneBias: true });
    pick(eveningCandidates, "19:30", L("야간 탐방 1", "Evening discovery 1"), { exclude: ["parks", "museums"], returnBias: true });
    pick(eveningCandidates, "21:00", L("야간 탐방 2", "Evening discovery 2"), { exclude: ["parks", "museums"], returnBias: true });
  } else if (slowPace) {
    pick(morningCandidates, "10:00", L("여유로운 오전 방문", "Relaxed morning visit"), { zoneBias: true });
    pick(groups.restaurants, "12:00", L("점심 식사", "Lunch"), { avoidCuisine: true, zoneBias: true });
    pick(afternoonCandidates, "15:00", L("여유로운 오후 방문", "Relaxed afternoon visit"), { zoneBias: true, returnBias: true });
    pick(groups.restaurants, "18:00", L("저녁 식사", "Dinner"), { avoidCuisine: true, returnBias: true });
  } else {
    pick(morningCandidates, "10:00", L("오전 문화 방문", "Morning culture visit"), { zoneBias: true });
    pick(groups.restaurants, "12:00", L("점심 식사", "Lunch"), { avoidCuisine: true, zoneBias: true });
    pick(groups.cafes, "14:30", L("평점 좋은 로컬 카페", "Highly rated local café"), { zoneBias: true });
    pick(afternoonCandidates, "16:30", L("오후 전시·명소", "Afternoon exhibition or sight"), { zoneBias: true });
    pick(groups.restaurants, "18:00", L("저녁 식사", "Dinner"), { avoidCuisine: true, zoneBias: true });
    pick(eveningCandidates, "20:30", L("야간 방문", "Evening visit"), { exclude: ["parks", "museums"], returnBias: true });
  }

  const returnStop: ItineraryStop | null = accommodation ? {
    ...accommodation,
    id: "user-accommodation-return",
    scheduledTime: "23:00",
    role: L("숙소 도착", "Return to accommodation"),
    hoursChecked: false,
    accommodationStop: true,
  } : null;
  const routeStops = accommodation ? [accommodation, ...visits, ...(returnStop ? [returnStop] : [])] : visits;
  const loopDistanceKm = accommodation && current ? travelledKm + distanceKm(current, accommodation) : travelledKm;
  return { visits: [...visits, ...(returnStop ? [returnStop] : [])], routeStops, accommodation, slowPace, maximizeStops, loopDistanceKm, slowDistanceLimitKm };
}

function usePlanRoute(stops: LivePlace[], lang: Lang, preference: "" | "FEWER_TRANSFERS" | "LESS_WALKING" = "") {
  const [result, setResult] = useState<{ key: string; route: RouteData } | null>(null);
  const key = stops.map(stop => `${stop.id}:${stop.location.latitude.toFixed(5)},${stop.location.longitude.toFixed(5)}`).join("|");
  const requestKey = `${key}|${lang}|${preference}`;
  useEffect(() => {
    if (stops.length < 2) return;
    const controller = new AbortController();
    fetch("/api/routes", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ points: routePoints(stops), lang, preference }),
    }).then(response => response.json()).then(route => setResult({ key: requestKey, route })).catch(() => undefined);
    return () => controller.abort();
  }, [key, lang, preference, requestKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return result?.key === requestKey ? result.route : null;
}

function AirportTransferPanel({ lang, trip, airports }: { lang: Lang; trip: Trip; airports: LivePlace[] }) {
  const accommodation = accommodationPlace(trip);
  const internationalAirports = accommodation
    ? airports.filter(airport => airport.isInternationalAirport).sort((a, b) => distanceKm(accommodation, a) - distanceKm(accommodation, b))
    : [];
  const nearestAirport = internationalAirports[0] || null;
  const [selectedAirportId, setSelectedAirportId] = useState("");
  const selectedAirport = internationalAirports.find(airport => airport.id === selectedAirportId)
    || nearestAirport;
  const transferStops = selectedAirport && accommodation ? [selectedAirport, accommodation] : [];
  const route = usePlanRoute(transferStops, lang, "FEWER_TRANSFERS");
  const directDistance = selectedAirport && accommodation ? distanceKm(selectedAirport, accommodation) * 1000 : 0;
  const leg = route?.legs[0];
  const transitSteps = leg?.steps.filter(step => step.mode === "TRANSIT") || [];
  const title = pickCopy(lang, { KR: "국제공항에서 숙소까지", EN: "International airport to accommodation", ZH: "从国际机场到住宿", JA: "国際空港から宿泊先まで", VI: "Từ sân bay quốc tế đến nơi lưu trú" });
  const emptyMessage = !accommodation
    ? pickCopy(lang, { KR: "숙소 위치를 확인한 뒤 가장 가까운 국제공항 경로를 표시합니다.", EN: "The nearest international-airport route appears after the accommodation location is resolved.", ZH: "确认住宿位置后将显示最近国际机场路线。", JA: "宿泊先の位置確認後、最寄り国際空港ルートを表示します。", VI: "Lộ trình từ sân bay quốc tế gần nhất sẽ hiện sau khi xác định vị trí lưu trú." })
    : pickCopy(lang, { KR: "이 나라에서 확인된 국제공항 데이터가 없습니다.", EN: "No verified international-airport data is available for this country.", ZH: "此国家暂无已验证的国际机场数据。", JA: "この国では確認済みの国際空港データがありません。", VI: "Không có dữ liệu sân bay quốc tế đã xác minh cho quốc gia này." });
  return <section className="airport-transfer glass-strong" aria-label={title}><div className="airport-transfer-head"><div><span>00 · INTERNATIONAL AIRPORT TRANSFER</span><h2>✈ {title}</h2><p>{selectedAirport ? `${selectedAirport.name} → ${accommodation?.name}` : emptyMessage}</p></div>{selectedAirport?.googleMapsUri && <a href={selectedAirport.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a>}</div>{selectedAirport && accommodation ? <><label className="airport-selector"><span>{pickCopy(lang, { KR: `${trip.country || "해당 국가"}의 다른 국제공항 선택`, EN: `Choose another international airport in ${trip.country || "this country"}`, ZH: "选择该国其他国际机场", JA: "この国の別の国際空港を選択", VI: "Chọn sân bay quốc tế khác trong quốc gia này" })}</span><select value={selectedAirport.id} onChange={event => setSelectedAirportId(event.target.value)}>{internationalAirports.map((airport, index) => <option key={airport.id} value={airport.id}>{index === 0 ? `${pickCopy(lang, { KR: "가장 가까움", EN: "Nearest", ZH: "最近", JA: "最寄り", VI: "Gần nhất" })} · ` : ""}{airport.name} · {distanceKm(accommodation, airport).toFixed(1)} km</option>)}</select></label><div className="airport-transfer-grid"><div className="airport-transfer-map"><LocationMap center={[selectedAirport.location.longitude, selectedAirport.location.latitude]} label={`${selectedAirport.name} → ${accommodation.name}`} lang={lang} routeCoordinates={route?.geometry || []} stops={mapStops([accommodation])} airports={mapStops([selectedAirport])} /></div><div className="airport-transfer-details"><div className="airport-metrics"><div><span>{pickCopy(lang, { KR: "거리", EN: "Distance", ZH: "距离", JA: "距離", VI: "Khoảng cách" })}</span><b>{formatDistance(route?.totalDistanceMeters || directDistance)}</b></div><div><span>{pickCopy(lang, { KR: "예상 소요시간", EN: "Travel time", ZH: "预计时间", JA: "所要時間", VI: "Thời gian" })}</span><b>{route ? formatDuration(route.totalDurationSeconds, lang) : "…"}</b></div><div><span>{pickCopy(lang, { KR: "환승", EN: "Transfers", ZH: "换乘", JA: "乗換", VI: "Chuyển tuyến" })}</span><b>{route?.totalTransfers ?? "—"}</b></div><div><span>{pickCopy(lang, { KR: "예상 요금", EN: "Fare", ZH: "预计费用", JA: "予想運賃", VI: "Giá vé" })}</span><b>{route?.totalFare || "—"}</b></div></div><div className="airport-steps"><span>{route?.source || pickCopy(lang, { KR: "실시간 교통 경로 계산 중…", EN: "Calculating the live transfer route…", ZH: "正在计算实时交通路线…", JA: "交通ルートを計算中…", VI: "Đang tính lộ trình giao thông…" })}</span>{transitSteps.length ? transitSteps.map((step, index) => <p key={`${step.line}-${index}`}><b>{step.line || pickCopy(lang, { KR: "대중교통", EN: "Transit", ZH: "公共交通", JA: "公共交通", VI: "Phương tiện công cộng" })}</b><small>{step.stops} {pickCopy(lang, { KR: "정거장", EN: "stops", ZH: "站", JA: "停留所", VI: "điểm dừng" })}</small></p>) : <p><b>{route?.transitAvailable === false ? pickCopy(lang, { KR: "도로 경로", EN: "Road route", ZH: "道路路线", JA: "道路ルート", VI: "Lộ trình đường bộ" }) : pickCopy(lang, { KR: "교통 정보 확인 중", EN: "Checking transit details", ZH: "正在查询交通信息", JA: "交通情報を確認中", VI: "Đang kiểm tra giao thông" })}</b><small>{route?.transitAvailable === false ? pickCopy(lang, { KR: "대중교통 상세정보가 제공되지 않아 실제 도로 경로를 표시합니다.", EN: "Detailed transit data is unavailable, so the real road route is shown.", ZH: "暂无公共交通详情，显示实际道路路线。", JA: "公共交通の詳細がないため、実際の道路ルートを表示します。", VI: "Không có chi tiết giao thông công cộng nên hiển thị lộ trình đường bộ thực tế." }) : ""}</small></p>}</div></div></div></> : <div className="airport-transfer-empty">{emptyMessage}</div>}</section>;
}

const ui = {
  KR: {
    plan: "플랜", explore: "탐색", route: "경로", community: "커뮤니티", profile: "MY", live: "지도 데이터", home: "LOCI 홈", language: "영어로 변경",
    destination: "방문하려는 지역", accommodation: "예약한 숙소 이름 또는 주소", dates: "여행 날짜", travelers: "방문객", purpose: "여행 목적", style: "선호하는 여행 스타일", upTo: "최대 5개",
    ask: "어디로 떠나볼까요?", make: "나만의 여행 플랜 만들기", analyzing: "목적지 맥락을 분석하고 있어요…", current: "현재 위치", privacy: "입력 정보는 추천 플랜 생성에만 사용됩니다.",
    heroTitle: "여행의 모든 맥락을\n하나의 흐름으로.", heroBody: "장소, 이동, 날씨, 취향, 현지의 목소리까지. LOCI가 지금의 당신에게 맞는 여행을 조율합니다.",
    living: "나의 실시간 플랜", inCity: "에서\n천천히, 깊게.", planEdit: "플랜 수정", confirm: "이 플랜으로 확정", confirmed: "✓ 일정이 확정됐어요", totalCost: "예상 총 비용", forPeople: "인 기준", fullRoute: "전체 경로 보기",
    placeInfo: "장소 정보", reorder: "순서 변경", dataSource: "데이터 출처", mapBased: "실제 지도 기반", liveAvailable: "연결된 API의 최신 데이터", estimate: "라이브 API 미연결 시 명확히 표시되는 추정값",
    exploreTitle: "장소를 찾는 데서 끝나지 않도록.", exploreBody: "목적지 안에서 언제, 어떻게, 무엇을 선택할지 지도와 함께 비교하세요.", search: "장소, 메뉴, 분위기를 검색하세요", mapView: "지도에서 보기", all: "전체", noResult: "검색 결과가 없어요. 다른 키워드로 찾아보세요.",
    recommendedTime: "추천 시간", currentCrowd: "예상 혼잡도", expectedCost: "예상 비용", lociScore: "LOCI 점수", addPlan: "플랜에 추가 +", reviews: "이용자 리뷰", reviewPlaceholder: "분위기, 메뉴, 팁이나 주의사항을 공유해 주세요.", submitReview: "리뷰 등록", justNow: "방금",
    routeTitle: "빠르기만 한 길보다,\n지금 나에게 맞는 길.", routeBody: "실시간 교통, 비용, 환승, 걷는 거리를 함께 비교합니다.", from: "출발", to: "도착", searchAgain: "다시 검색", updated: "방금 갱신", routeReason: "이 경로를 추천하는 이유", startRoute: "이 경로로 출발", selectedRoute: "선택 경로", estimatedRoute: "교통 API 연결 전에는 목적지 기반 예시 경로입니다.",
    communityTitle: "도시는 지도보다\n사람의 이야기로 선명해져요.", newPost: "새 글 쓰기 +", countryCommunity: "여행자들의 지금", popular: "인기", newest: "최신", questions: "질문", firstStory: "이 지역의 첫 이야기를 남겨보세요.", edit: "수정", delete: "삭제", cancel: "취소", publish: "게시하기", save: "변경 저장", postTitle: "제목", postBody: "경험, 팁, 질문을 자유롭게 적어주세요.", deleteAsk: "이 게시물을 삭제할까요?", deleteExplain: "삭제는 되돌릴 수 없습니다. 메뉴를 여는 것만으로는 게시물이 삭제되지 않습니다.",
    freePlan: "무료 플랜", connections: "데이터 연결", ready: "준비됨", optional: "키 연결 시 실시간", scoreMethod: "점수는 이렇게 만들어져요.", close: "닫기",
  },
  EN: {
    plan: "Plan", explore: "Explore", route: "Routes", community: "Community", profile: "My", live: "Map data", home: "LOCI home", language: "Switch to Korean",
    destination: "Destination", accommodation: "Booked accommodation name or address", dates: "Travel dates", travelers: "Travelers", purpose: "Trip purpose", style: "Travel style", upTo: "Choose up to 5",
    ask: "Where are you going?", make: "Create my trip plans", analyzing: "Reading your destination context…", current: "Use my location", privacy: "Your answers are used only to create your recommendations.",
    heroTitle: "Every travel signal,\nin one clear flow.", heroBody: "Places, mobility, weather, preferences, and local voices. LOCI conducts a trip that fits you now.",
    living: "Your living plan", inCity: ",\nat your own pace.", planEdit: "Edit trip profile", confirm: "Confirm this plan", confirmed: "✓ Plan confirmed", totalCost: "Estimated total", forPeople: " travelers", fullRoute: "View full route",
    placeInfo: "Place details", reorder: "Reorder", dataSource: "Data source", mapBased: "Real map context", liveAvailable: "Latest data from connected APIs", estimate: "Estimates are clearly labeled when live APIs are unavailable",
    exploreTitle: "Go beyond finding a place.", exploreBody: "Compare when to visit, what to choose, and how to get there—inside your destination.", search: "Search places, menus, or atmosphere", mapView: "Open map", all: "All", noResult: "No results. Try another keyword.",
    recommendedTime: "Best time", currentCrowd: "Est. crowd", expectedCost: "Est. cost", lociScore: "LOCI score", addPlan: "Add to plan +", reviews: "Traveler reviews", reviewPlaceholder: "Share atmosphere, menu tips, access notes, or cautions.", submitReview: "Post review", justNow: "Now",
    routeTitle: "Not just the fastest route—\nthe route that fits you.", routeBody: "Compare traffic, cost, transfers, walking, and travel time together.", from: "From", to: "To", searchAgain: "Search again", updated: "Updated now", routeReason: "Why this route", startRoute: "Start this route", selectedRoute: "Selected route", estimatedRoute: "Destination-aware sample routes are shown until a traffic API is connected.",
    communityTitle: "A city becomes clearer\nthrough its people.", newPost: "Write a post +", countryCommunity: "travelers right now", popular: "Popular", newest: "Newest", questions: "Questions", firstStory: "Be the first to share a story here.", edit: "Edit", delete: "Delete", cancel: "Cancel", publish: "Publish", save: "Save changes", postTitle: "Title", postBody: "Share an experience, tip, or question.", deleteAsk: "Delete this post?", deleteExplain: "This cannot be undone. Opening the menu never deletes a post.",
    freePlan: "Free plan", connections: "Data connections", ready: "Ready", optional: "Live when a key is connected", scoreMethod: "How the score works", close: "Close",
  },
  ZH: {
    plan: "行程", explore: "探索", route: "路线", community: "社区", profile: "我的", live: "地图数据", home: "LOCI 首页", language: "更改语言",
    destination: "旅行地区", accommodation: "已预订住宿的名称或地址", dates: "旅行日期", travelers: "旅行人数", purpose: "旅行目的", style: "偏好的旅行方式", upTo: "最多选择5项",
    ask: "想去哪里旅行？", make: "创建我的旅行计划", analyzing: "正在分析目的地信息…", current: "使用当前位置", privacy: "输入信息仅用于生成旅行推荐。",
    heroTitle: "所有旅行信息，\n汇聚为清晰旅程。", heroBody: "地点、交通、天气、偏好与当地声音。LOCI 为此刻的你编排合适的旅行。",
    living: "我的实时行程", inCity: "，\n从容深入地探索。", planEdit: "编辑旅行资料", confirm: "确认此行程", confirmed: "✓ 行程已确认", totalCost: "预计总费用", forPeople: "人", fullRoute: "查看完整路线",
    placeInfo: "地点详情", reorder: "调整顺序", dataSource: "数据来源", mapBased: "真实地图数据", liveAvailable: "来自已连接 API 的最新数据", estimate: "未连接实时 API 时会明确标注估算值",
    exploreTitle: "不止是找到一个地点。", exploreBody: "结合地图比较目的地内的访问时间、选择与交通方式。", search: "搜索地点、菜单或氛围", mapView: "在地图中查看", all: "全部", noResult: "没有结果，请尝试其他关键词。",
    recommendedTime: "推荐时间", currentCrowd: "预计拥挤度", expectedCost: "预计费用", lociScore: "LOCI 评分", addPlan: "加入行程 +", reviews: "用户评价", reviewPlaceholder: "分享氛围、菜单、交通提示或注意事项。", submitReview: "发布评价", justNow: "刚刚",
    routeTitle: "不只追求最快，\n更选择适合你的路线。", routeBody: "同时比较交通、费用、换乘、步行和所需时间。", from: "出发", to: "到达", searchAgain: "重新搜索", updated: "刚刚更新", routeReason: "推荐这条路线的原因", startRoute: "按此路线出发", selectedRoute: "已选路线", estimatedRoute: "连接交通 API 前会明确标注替代路线。",
    communityTitle: "一座城市，\n因旅行者的故事而清晰。", newPost: "发布新帖 +", countryCommunity: "旅行者正在分享", popular: "热门", newest: "最新", questions: "问答", firstStory: "分享这个地区的第一个故事。", edit: "编辑", delete: "删除", cancel: "取消", publish: "发布", save: "保存更改", postTitle: "标题", postBody: "自由分享体验、提示或问题。", deleteAsk: "删除这篇帖子吗？", deleteExplain: "删除后无法恢复。打开菜单不会删除帖子。",
    freePlan: "免费计划", connections: "数据连接", ready: "已就绪", optional: "连接密钥后启用实时数据", scoreMethod: "评分计算方式", close: "关闭",
  },
  JA: {
    plan: "プラン", explore: "探す", route: "ルート", community: "コミュニティ", profile: "マイページ", live: "地図データ", home: "LOCI ホーム", language: "言語を変更",
    destination: "旅行先", accommodation: "予約済み宿泊先の名称または住所", dates: "旅行日程", travelers: "旅行者", purpose: "旅行目的", style: "好みの旅行スタイル", upTo: "最大5つ",
    ask: "どこへ旅しますか？", make: "旅行プランを作成", analyzing: "旅行先の情報を分析中…", current: "現在地を使う", privacy: "入力情報は旅行プランの作成にのみ使用されます。",
    heroTitle: "旅のすべてを、\nひとつの流れに。", heroBody: "場所、移動、天気、好み、現地の声。LOCIが今のあなたに合う旅を組み立てます。",
    living: "リアルタイムプラン", inCity: "を、\nゆっくり深く。", planEdit: "旅行情報を編集", confirm: "このプランを確定", confirmed: "✓ プランを確定しました", totalCost: "予想合計費用", forPeople: "名", fullRoute: "全ルートを見る",
    placeInfo: "場所の詳細", reorder: "順序を変更", dataSource: "データソース", mapBased: "実際の地図データ", liveAvailable: "接続済みAPIの最新データ", estimate: "リアルタイムAPI未接続時は推定値を明示",
    exploreTitle: "場所を見つける、その先へ。", exploreBody: "いつ、どこへ、どう移動するかを地図と一緒に比較できます。", search: "場所・メニュー・雰囲気を検索", mapView: "地図で見る", all: "すべて", noResult: "結果がありません。別のキーワードをお試しください。",
    recommendedTime: "おすすめ時間", currentCrowd: "混雑予想", expectedCost: "予想費用", lociScore: "LOCIスコア", addPlan: "プランに追加 +", reviews: "旅行者レビュー", reviewPlaceholder: "雰囲気、メニュー、アクセス、注意点を共有してください。", submitReview: "レビューを投稿", justNow: "たった今",
    routeTitle: "最速だけでなく、\n自分に合う道を。", routeBody: "交通、料金、乗換、徒歩、所要時間をまとめて比較します。", from: "出発", to: "到着", searchAgain: "再検索", updated: "更新済み", routeReason: "このルートをおすすめする理由", startRoute: "このルートで出発", selectedRoute: "選択ルート", estimatedRoute: "交通API未接続時は代替ルートを明示します。",
    communityTitle: "街は地図より、\n人の物語で鮮明になる。", newPost: "新規投稿 +", countryCommunity: "旅行者の最新情報", popular: "人気", newest: "新着", questions: "質問", firstStory: "この地域の最初の物語を投稿しましょう。", edit: "編集", delete: "削除", cancel: "キャンセル", publish: "投稿", save: "変更を保存", postTitle: "タイトル", postBody: "体験、ヒント、質問を自由に共有してください。", deleteAsk: "この投稿を削除しますか？", deleteExplain: "削除は元に戻せません。メニューを開くだけでは削除されません。",
    freePlan: "無料プラン", connections: "データ接続", ready: "準備完了", optional: "キー接続でリアルタイム", scoreMethod: "スコアの計算方法", close: "閉じる",
  },
  VI: {
    plan: "Kế hoạch", explore: "Khám phá", route: "Lộ trình", community: "Cộng đồng", profile: "Cá nhân", live: "Dữ liệu bản đồ", home: "Trang chủ LOCI", language: "Đổi ngôn ngữ",
    destination: "Điểm đến", accommodation: "Tên hoặc địa chỉ nơi lưu trú đã đặt", dates: "Ngày du lịch", travelers: "Số người", purpose: "Mục đích chuyến đi", style: "Phong cách du lịch", upTo: "Chọn tối đa 5",
    ask: "Bạn muốn đi đâu?", make: "Tạo kế hoạch chuyến đi", analyzing: "Đang phân tích điểm đến…", current: "Dùng vị trí hiện tại", privacy: "Thông tin chỉ được dùng để tạo đề xuất chuyến đi.",
    heroTitle: "Mọi tín hiệu du lịch,\ntrong một hành trình rõ ràng.", heroBody: "Địa điểm, di chuyển, thời tiết, sở thích và tiếng nói địa phương. LOCI điều phối chuyến đi phù hợp với bạn.",
    living: "Kế hoạch trực tiếp", inCity: ",\nchậm rãi và sâu sắc.", planEdit: "Sửa thông tin chuyến đi", confirm: "Xác nhận kế hoạch", confirmed: "✓ Đã xác nhận", totalCost: "Tổng chi phí dự kiến", forPeople: " người", fullRoute: "Xem toàn bộ lộ trình",
    placeInfo: "Chi tiết địa điểm", reorder: "Đổi thứ tự", dataSource: "Nguồn dữ liệu", mapBased: "Dữ liệu bản đồ thực", liveAvailable: "Dữ liệu mới nhất từ API đã kết nối", estimate: "Ước tính được ghi rõ khi chưa có API trực tiếp",
    exploreTitle: "Không chỉ dừng ở việc tìm địa điểm.", exploreBody: "So sánh thời gian, lựa chọn và cách di chuyển trên bản đồ.", search: "Tìm địa điểm, món ăn hoặc không khí", mapView: "Xem trên bản đồ", all: "Tất cả", noResult: "Không có kết quả. Hãy thử từ khóa khác.",
    recommendedTime: "Thời gian phù hợp", currentCrowd: "Độ đông dự kiến", expectedCost: "Chi phí dự kiến", lociScore: "Điểm LOCI", addPlan: "Thêm vào kế hoạch +", reviews: "Đánh giá du khách", reviewPlaceholder: "Chia sẻ không khí, món ăn, cách đi hoặc lưu ý.", submitReview: "Đăng đánh giá", justNow: "Vừa xong",
    routeTitle: "Không chỉ nhanh nhất,\nmà phù hợp nhất với bạn.", routeBody: "So sánh giao thông, chi phí, chuyển tuyến, đi bộ và thời gian.", from: "Điểm đi", to: "Điểm đến", searchAgain: "Tìm lại", updated: "Vừa cập nhật", routeReason: "Lý do đề xuất lộ trình", startRoute: "Bắt đầu theo lộ trình", selectedRoute: "Lộ trình đã chọn", estimatedRoute: "Lộ trình thay thế được ghi rõ khi chưa kết nối API giao thông.",
    communityTitle: "Thành phố rõ nét hơn\nqua câu chuyện con người.", newPost: "Viết bài +", countryCommunity: "du khách đang chia sẻ", popular: "Phổ biến", newest: "Mới nhất", questions: "Câu hỏi", firstStory: "Hãy chia sẻ câu chuyện đầu tiên về khu vực này.", edit: "Sửa", delete: "Xóa", cancel: "Hủy", publish: "Đăng", save: "Lưu thay đổi", postTitle: "Tiêu đề", postBody: "Chia sẻ trải nghiệm, mẹo hoặc câu hỏi.", deleteAsk: "Xóa bài viết này?", deleteExplain: "Không thể hoàn tác. Mở menu sẽ không xóa bài viết.",
    freePlan: "Gói miễn phí", connections: "Kết nối dữ liệu", ready: "Sẵn sàng", optional: "Trực tiếp khi kết nối khóa", scoreMethod: "Cách tính điểm", close: "Đóng",
  },
} as const;

const rawProfiles: Array<Profile & { keywords: string[] }> = [
  { keywords: ["서울", "seoul"], known: true, city: L("서울", "Seoul"), country: "South Korea", countryCode: "KR", coords: [126.978, 37.5665], currency: "₩", places: [
    place("gyeongbokgung", "경복궁", "Gyeongbokgung Palace", "종로", "Jongno", "궁궐 · 문화", "Palace · Culture", "오전 수문장 교대식 시간을 확인하세요.", "Check the morning guard-changing time.", 9.2, "₩3–15K", 58, "09:00–11:00", "blue", [L("역사", "History"), L("산책", "Walk")]),
    place("gwangjang", "광장시장", "Gwangjang Market", "종로", "Jongno", "시장 · 음식", "Market · Food", "메인 통로보다 동쪽 입구가 비교적 여유로워요.", "The east entrance is calmer than the main aisle.", 9.1, "₩15–30K", 76, "11:00–13:00", "amber", [L("로컬", "Local"), L("미식", "Food")]),
    place("seongsu", "서울숲 & 성수", "Seoul Forest & Seongsu", "성동", "Seongdong", "공원 · 카페", "Park · Cafés", "서울숲 북쪽 출구에서 카페 거리로 이어가세요.", "Use the north park exit for the shortest café route.", 8.8, "₩12–25K", 62, "15:00–18:00", "green", [L("카페", "Café"), L("휴식", "Slow")]),
    place("euljiro", "을지로 골목", "Euljiro Alleys", "중구", "Jung-gu", "식당 · 야간", "Food · Night", "오래된 건물의 접근성을 방문 전 확인하세요.", "Check accessibility in older buildings before visiting.", 8.6, "₩25–50K", 69, "18:00–21:00", "violet", [L("야간", "Night"), L("로컬", "Local")]),
  ]},
  { keywords: ["도쿄", "tokyo", "東京"], known: true, city: L("도쿄", "Tokyo"), country: "Japan", countryCode: "JP", coords: [139.6917, 35.6895], currency: "¥", places: [
    place("asakusa", "아사쿠사 센소지", "Sensō-ji, Asakusa", "다이토", "Taito", "사찰 · 역사", "Temple · History", "나카미세 상점이 열리기 전 이른 아침이 한적해요.", "Arrive early before Nakamise shops open.", 9.3, "¥1–3K", 64, "07:30–09:30", "blue", [L("문화", "Culture"), L("사진", "Photo")]),
    place("tsukiji", "쓰키지 장외시장", "Tsukiji Outer Market", "주오", "Chuo", "시장 · 음식", "Market · Food", "여러 가게에서 작은 메뉴를 나눠 드세요.", "Share small dishes across several stalls.", 9.0, "¥3–6K", 78, "09:30–11:30", "amber", [L("스시", "Sushi"), L("로컬", "Local")]),
    place("meiji", "메이지 신궁", "Meiji Shrine", "시부야", "Shibuya", "숲 · 신사", "Forest · Shrine", "하라주쿠역보다 북쪽 입구가 비교적 조용해요.", "The northern approach is often calmer.", 8.9, "무료", 52, "14:00–16:00", "green", [L("산책", "Walk"), L("자연", "Nature")]),
    place("shibuya", "시부야 스카이", "Shibuya Sky", "시부야", "Shibuya", "전망 · 야간", "View · Night", "일몰 시간대는 사전 예약을 권장해요.", "Reserve the sunset slot in advance.", 9.1, "¥2–4K", 81, "17:00–19:00", "violet", [L("전망", "View"), L("야경", "Night")]),
  ]},
  { keywords: ["파리", "paris"], known: true, city: L("파리", "Paris"), country: "France", countryCode: "FR", coords: [2.3522, 48.8566], currency: "€", places: [
    place("montmartre", "몽마르트르 언덕", "Montmartre", "18구", "18th", "마을 · 전망", "Quarter · View", "아베스역에서 오르면 골목을 천천히 즐길 수 있어요.", "Walk up from Abbesses for quieter side streets.", 9.0, "€0–15", 67, "08:30–10:30", "blue", [L("산책", "Walk"), L("전망", "View")]),
    place("marche", "마르셰 데 앙팡 루즈", "Marché des Enfants Rouges", "마레", "Marais", "시장 · 음식", "Market · Food", "점심 피크 직전인 11시 30분이 좋아요.", "Visit around 11:30 before the lunch peak.", 8.8, "€15–30", 71, "11:30–13:30", "amber", [L("미식", "Food"), L("시장", "Market")]),
    place("luxembourg", "뤽상부르 공원", "Luxembourg Gardens", "6구", "6th", "공원 · 휴식", "Park · Slow", "남쪽 잔디보다 분수 주변 의자가 여행자에게 편해요.", "The chairs near the fountain are ideal for a pause.", 8.9, "무료", 44, "14:30–16:30", "green", [L("공원", "Park"), L("휴식", "Slow")]),
    place("seine", "센강과 생제르맹", "Seine & Saint-Germain", "좌안", "Left Bank", "산책 · 야간", "Walk · Evening", "해 질 무렵 퐁뇌프에서 서쪽으로 걸어보세요.", "Walk west from Pont Neuf near sunset.", 9.2, "€10–35", 59, "18:00–21:00", "violet", [L("일몰", "Sunset"), L("분위기", "Mood")]),
  ]},
  { keywords: ["뉴욕", "new york", "nyc"], known: true, city: L("뉴욕", "New York"), country: "United States of America", countryCode: "US", coords: [-74.006, 40.7128], currency: "$", places: [
    place("highline", "하이라인", "The High Line", "맨해튼", "Manhattan", "공원 · 산책", "Park · Walk", "허드슨야드에서 남쪽으로 걷는 동선이 편해요.", "Walk south from Hudson Yards for an easy flow.", 9.0, "$0–15", 61, "08:00–10:00", "green", [L("산책", "Walk"), L("도시", "Urban")]),
    place("chelsea", "첼시 마켓", "Chelsea Market", "맨해튼", "Manhattan", "시장 · 음식", "Market · Food", "정오보다 11시대가 좌석을 찾기 쉬워요.", "Seats are easier to find before noon.", 8.8, "$20–40", 79, "11:00–13:00", "amber", [L("미식", "Food"), L("실내", "Indoor")]),
    place("met", "메트로폴리탄 미술관", "The Metropolitan Museum of Art", "어퍼이스트", "Upper East", "미술관 · 문화", "Museum · Culture", "보고 싶은 전시관 세 곳을 먼저 정하세요.", "Choose three galleries before entering.", 9.4, "$0–30", 72, "14:00–17:00", "blue", [L("예술", "Art"), L("문화", "Culture")]),
    place("dumbo", "덤보 & 브루클린 브리지", "DUMBO & Brooklyn Bridge", "브루클린", "Brooklyn", "전망 · 야간", "View · Night", "브루클린 쪽에서 맨해튼으로 건너세요.", "Cross toward Manhattan from Brooklyn.", 9.1, "$0–25", 68, "18:00–21:00", "violet", [L("야경", "Night"), L("사진", "Photo")]),
  ]},
];

function place(id: string, ko: string, en: string, areaKo: string, areaEn: string, typeKo: string, typeEn: string, tipKo: string, tipEn: string, rating: number, cost: string, crowd: number, time: string, color: string, tags: Localized[]): Place {
  return { id, name: L(ko, en), area: L(areaKo, areaEn), type: L(typeKo, typeEn), tip: L(tipKo, tipEn), tags, rating, cost, crowd, time, color };
}

function destinationProfile(destination: string): Profile {
  const key = destination.toLowerCase();
  const known = rawProfiles.find(profile => profile.keywords.some(keyword => key.includes(keyword)));
  if (known) return known;
  const city = destination.split(",")[0].trim() || "Your destination";
  return { city: L(city, city), country: city, countryCode: "--", coords: [0, 20], currency: "", places: [], known: false };
}

function Brand({ onHome, lang }: { onHome: () => void; lang: Lang }) {
  return <button type="button" className="brand" aria-label={ui[lang].home} onClick={onHome}><span className="brand-orbit">◌</span><span>LOCI</span></button>;
}

function TopBar({ lang, setLang, onProfile, onHome }: { lang: Lang; setLang: (v: Lang) => void; onProfile: () => void; onHome: () => void }) {
  const u = ui[lang];
  return <header className="topbar glass"><Brand onHome={onHome} lang={lang} /><div className="top-actions"><span className="live-chip"><i /> {u.live}</span><label className="language-picker"><span className="sr-only">{u.language}</span><select value={lang} onChange={event => setLang(event.target.value as Lang)} aria-label={u.language}>{languageOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><button type="button" className="avatar" onClick={onProfile} aria-label={u.profile}>G</button></div></header>;
}

function BottomNav({ lang, screen, setScreen }: { lang: Lang; screen: Screen; setScreen: (s: Screen) => void }) {
  const u = ui[lang];
  const items: Array<[Screen, string, string]> = [["plan", "✦", u.plan], ["explore", "⌕", u.explore], ["route", "↝", u.route], ["community", "◎", u.community], ["profile", "○", u.profile]];
  return <nav className="bottom-nav glass" aria-label={pickCopy(lang, { KR: "주요 메뉴", EN: "Main navigation", ZH: "主导航", JA: "メインナビゲーション", VI: "Điều hướng chính" })}>{items.map(([key, icon, label]) => <button type="button" key={key} className={screen === key ? "active" : ""} onClick={() => setScreen(key)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

function Onboarding({ lang, initial, onGenerate }: { lang: Lang; initial: Trip; onGenerate: (trip: Trip) => void }) {
  const u = ui[lang];
  const [destination, setDestination] = useState(initial.destination);
  const [accommodation, setAccommodation] = useState(initial.accommodation);
  const [people, setPeople] = useState(initial.people);
  const initialDates = initial.dates.match(/\d{4}-\d{2}-\d{2}/g) || [];
  const [startDate, setStartDate] = useState(initialDates[0] || "");
  const [endDate, setEndDate] = useState(initialDates[1] || initialDates[0] || "");
  const [purpose, setPurpose] = useState(initial.purpose);
  const [styles, setStyles] = useState(initial.styles);
  const [coords, setCoords] = useState<[number, number] | undefined>(initial.coords);
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(initial.country || "");
  const [selectedCountryCode, setSelectedCountryCode] = useState(initial.countryCode && initial.countryCode !== "--" ? initial.countryCode : "");
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionMessage, setRegionMessage] = useState("");
  const [manualRegion, setManualRegion] = useState("");
  const purposes: Array<{ key: string; label: Record<Lang, string> }> = [
    { key: "rest", label: { KR: "휴식", EN: "Relax", ZH: "休闲", JA: "リラックス", VI: "Nghỉ dưỡng" } },
    { key: "date", label: { KR: "데이트", EN: "Couple", ZH: "情侣", JA: "カップル", VI: "Cặp đôi" } },
    { key: "family", label: { KR: "가족", EN: "Family", ZH: "家庭", JA: "家族", VI: "Gia đình" } },
    { key: "business", label: { KR: "비즈니스", EN: "Business", ZH: "商务", JA: "ビジネス", VI: "Công tác" } },
  ];
  const styleChoices = Object.entries(styleLabels).map(([key, label]) => ({ key, label }));
  const countryDisplay = useMemo(() => {
    if (!selectedCountryCode) return selectedCountry;
    try { return new Intl.DisplayNames([localeByLang[lang]], { type: "region" }).of(selectedCountryCode) || selectedCountry; }
    catch { return selectedCountry; }
  }, [lang, selectedCountry, selectedCountryCode]);

  useEffect(() => {
    if (!destinationPickerOpen || !selectedCountryCode) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setRegionsLoading(true);
      setRegionMessage("");
      return fetch(`/api/regions?countryCode=${encodeURIComponent(selectedCountryCode)}&lang=${lang}`, { signal: controller.signal });
    })
      .then(async response => {
        if (!response) return;
        const data = await response.json() as { regions?: RegionOption[]; error?: string };
        if (!response.ok && response.status !== 503) throw new Error(data.error || "Region lookup failed");
        setRegions(data.regions || []);
        setRegionMessage(data.error || "");
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") {
          setRegions([]);
          setRegionMessage(pickCopy(lang, { KR: "지역 목록을 불러오지 못했습니다. 국가 전체를 목적지로 선택할 수 있습니다.", EN: "Regions are temporarily unavailable. You can still choose the whole country.", ZH: "暂时无法加载地区列表，仍可选择整个国家。", JA: "地域一覧を取得できません。国全体を選択できます。", VI: "Tạm thời không tải được danh sách khu vực. Bạn vẫn có thể chọn toàn bộ quốc gia." }));
        }
      })
      .finally(() => setRegionsLoading(false));
    return () => controller.abort();
  }, [destinationPickerOpen, selectedCountryCode, lang]);

  const chooseCountry = () => {
    if (!countryDisplay) return;
    setDestination(countryDisplay);
    setCoords(undefined);
    setDestinationPickerOpen(false);
  };
  const chooseRegion = (region: RegionOption) => {
    setDestination(countryDisplay ? `${region.name}, ${countryDisplay}` : region.name);
    if (typeof region.longitude === "number" && typeof region.latitude === "number") setCoords([region.longitude, region.latitude]);
    else setCoords(undefined);
    setDestinationPickerOpen(false);
  };
  const chooseManualRegion = () => {
    const region = manualRegion.trim();
    if (!region) return;
    setDestination(countryDisplay ? `${region}, ${countryDisplay}` : region);
    setCoords(undefined);
    setDestinationPickerOpen(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (loading) return;
    if (!destination.trim() || !accommodation.trim() || !startDate || !endDate || !purpose || !styles.length) {
      setFormMessage(pickCopy(lang, { KR: "목적지, 예약 숙소, 시작·종료일, 여행 목적과 스타일을 입력해 주세요.", EN: "Enter a destination, accommodation, start and end dates, purpose, and at least one travel style.", ZH: "请输入目的地、住宿、开始和结束日期、旅行目的及至少一种旅行风格。", JA: "旅行先、宿泊先、開始日・終了日、目的、旅行スタイルを入力してください。", VI: "Hãy nhập điểm đến, nơi lưu trú, ngày bắt đầu và kết thúc, mục đích và ít nhất một phong cách." }));
      return;
    }
    if (endDate < startDate) {
      setFormMessage(pickCopy(lang, { KR: "여행 종료일은 시작일 이후여야 합니다.", EN: "The end date must be on or after the start date.", ZH: "结束日期必须晚于或等于开始日期。", JA: "終了日は開始日以降を選択してください。", VI: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." }));
      return;
    }
    setFormMessage(""); setLoading(true);
    const next: Trip = {
      destination: destination.trim(), accommodation: accommodation.trim(), people, dates: `${startDate} — ${endDate}`, purpose, styles, coords,
      country: selectedCountryCode ? countryDisplay : initial.country,
      countryCode: selectedCountryCode || initial.countryCode,
      accommodationCoords: accommodation === initial.accommodation ? initial.accommodationCoords : undefined,
      accommodationResolvedName: accommodation === initial.accommodation ? initial.accommodationResolvedName : undefined,
    };
    onGenerate(next);
  };
  return <><main className="onboarding-page"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><section className="onboarding-copy"><h1>{u.heroTitle.split("\n").map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1><p>{u.heroBody}</p><div className="signal-row"><span><b>WORLD</b> {pickCopy(lang, { KR: "전 세계 지도 검색", EN: "global map search", ZH: "全球地图搜索", JA: "世界地図検索", VI: "tìm kiếm toàn cầu" })}</span><span><b>3</b> {u.freePlan}</span><span><b>10.0</b> {pickCopy(lang, { KR: "출처 기반 점수", EN: "source-based score", ZH: "来源评分", JA: "出典ベースのスコア", VI: "điểm dựa trên nguồn" })}</span></div></section>
    <form className="survey glass-strong" onSubmit={submit} data-testid="trip-survey"><div className="survey-head"><h2>{u.ask}</h2></div>
      <label className="field-label">{u.destination} <span>Destination</span></label><div className="input-shell destination-input"><span>⌖</span><input required aria-label={u.destination} value={destination} onChange={e => { setDestination(e.target.value); setCoords(undefined); setSelectedCountry(""); setSelectedCountryCode(""); }} placeholder={pickCopy(lang, { KR: "예: 파리, 프랑스", EN: "e.g. Paris, France", ZH: "例如：法国巴黎", JA: "例：パリ、フランス", VI: "VD: Paris, Pháp" })} /><div className="input-actions"><button type="button" onClick={() => setDestinationPickerOpen(true)}>◎ {pickCopy(lang, { KR: "지도", EN: "Map", ZH: "地图", JA: "地図", VI: "Bản đồ" })}</button><button type="button" onClick={() => { if (!navigator.geolocation) { setFormMessage(pickCopy(lang, { KR: "이 브라우저에서는 현재 위치를 사용할 수 없습니다.", EN: "Location is unavailable in this browser.", ZH: "此浏览器无法使用当前位置。", JA: "このブラウザでは現在地を利用できません。", VI: "Trình duyệt này không hỗ trợ vị trí hiện tại." })); return; } setFormMessage(pickCopy(lang, { KR: "현재 위치를 확인하는 중…", EN: "Locating you…", ZH: "正在定位…", JA: "現在地を確認中…", VI: "Đang xác định vị trí…" })); navigator.geolocation.getCurrentPosition(position => { setCoords([position.coords.longitude, position.coords.latitude]); setDestination(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`); setFormMessage(pickCopy(lang, { KR: "현재 좌표를 목적지로 입력했습니다.", EN: "Current coordinates added as the destination.", ZH: "已将当前位置设为目的地。", JA: "現在地を旅行先に設定しました。", VI: "Đã dùng tọa độ hiện tại làm điểm đến." })); }, () => setFormMessage(pickCopy(lang, { KR: "위치 권한이 없어 직접 입력해 주세요.", EN: "Location permission was unavailable; enter the destination manually.", ZH: "无法获得位置权限，请手动输入。", JA: "位置情報を取得できません。手動で入力してください。", VI: "Không có quyền vị trí; vui lòng nhập thủ công." }))); }}>{u.current}</button></div></div>
      <label className="field-label">{u.accommodation} <span>Accommodation</span></label><div className="input-shell"><span>⌂</span><input required aria-label={u.accommodation} value={accommodation} onChange={e => setAccommodation(e.target.value)} placeholder={pickCopy(lang, { KR: "예: 호텔 이름 또는 전체 주소", EN: "e.g. hotel name or full address", ZH: "例如：酒店名称或完整地址", JA: "例：ホテル名または住所", VI: "VD: tên khách sạn hoặc địa chỉ đầy đủ" })} /></div><p className="field-help">{pickCopy(lang, { KR: "매일 숙소에서 출발해 23:00에 돌아오는 동선을 계산합니다.", EN: "Every day route starts here and returns by 23:00.", ZH: "每天从住宿出发，并规划在23:00前返回。", JA: "毎日ここから出発し、23:00までに戻るルートを計算します。", VI: "Mỗi ngày bắt đầu tại đây và trở về trước 23:00." })}</p>
      <div className="two-col date-traveler-grid"><div><label className="field-label">{u.dates} <span>Calendar range</span></label><div className="date-range"><label><span>{pickCopy(lang, { KR: "시작일", EN: "Start", ZH: "开始", JA: "開始", VI: "Bắt đầu" })}</span><input required type="date" value={startDate} max={endDate || undefined} onChange={event => { setStartDate(event.target.value); if (endDate && event.target.value > endDate) setEndDate(event.target.value); }} /></label><i>→</i><label><span>{pickCopy(lang, { KR: "종료일", EN: "End", ZH: "结束", JA: "終了", VI: "Kết thúc" })}</span><input required type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} /></label></div></div><div><label className="field-label">{u.travelers} <span>Travelers</span></label><div className="counter"><button type="button" onClick={() => setPeople(Math.max(1, people - 1))}>−</button><b>{people}{lang === "KR" ? "명" : ""}</b><button type="button" onClick={() => setPeople(people + 1)}>＋</button></div></div></div>
      <label className="field-label">{u.purpose} <span>Purpose</span></label><div className="segmented">{purposes.map(item => <button type="button" key={item.key} className={purpose === item.key ? "selected" : ""} onClick={() => setPurpose(item.key)}>{item.label[lang]}</button>)}</div>
      <label className="field-label">{u.style} <span>{u.upTo}</span></label><div className="chips style-chips">{styleChoices.map(item => <button type="button" key={item.key} className={styles.includes(item.key) ? "selected" : ""} onClick={() => setStyles(current => current.includes(item.key) ? current.filter(key => key !== item.key) : current.length < 5 ? [...current, item.key] : current)}>{styles.includes(item.key) ? "✓ " : "+ "}{t(lang, item.label)}</button>)}</div>
      {formMessage && <p className="form-message" role="status">{formMessage}</p>}<button className="primary-cta" data-testid="generate-plan" disabled={loading}>{loading ? <><span className="spinner" /> {u.analyzing}</> : <>{u.make} <span>↗</span></>}</button><p className="privacy-note">◇ {u.privacy}</p>
    </form></main>{destinationPickerOpen && <Modal wide lang={lang} onClose={() => setDestinationPickerOpen(false)}><div className="destination-picker-head"><span>WORLD DESTINATION PICKER</span><h2>{pickCopy(lang, { KR: "나라를 고르고 여행 지역을 선택하세요", EN: "Choose a country, then select a region", ZH: "选择国家，然后选择旅行地区", JA: "国を選び、旅行地域を選択してください", VI: "Chọn quốc gia, sau đó chọn khu vực" })}</h2><p>{pickCopy(lang, { KR: "모든 국가 경계를 지도에서 선택할 수 있으며, 선택 후 실제 행정구역 목록을 불러옵니다.", EN: "Select any country boundary on the map, then choose from its real administrative regions.", ZH: "可在地图上选择任意国家，随后从真实行政区列表中选择。", JA: "世界地図で国を選ぶと、実際の行政区一覧を読み込みます。", VI: "Chọn bất kỳ quốc gia nào trên bản đồ rồi chọn khu vực hành chính thực tế." })}</p></div><WorldCommunityMap lang={lang} selectedCountry={selectedCountry} selectedCode={selectedCountryCode} onSelectCountry={(country, code) => { setSelectedCountry(country); setSelectedCountryCode(code); setRegions([]); setManualRegion(""); }} /><section className="region-picker glass"><div className="region-picker-title"><div><span>{selectedCountryCode || "—"}</span><h3>{countryDisplay || pickCopy(lang, { KR: "국가를 선택하세요", EN: "Choose a country", ZH: "请选择国家", JA: "国を選択", VI: "Chọn quốc gia" })}</h3></div>{selectedCountryCode && <button type="button" className="soft-button" onClick={chooseCountry}>{pickCopy(lang, { KR: "국가 전체 선택", EN: "Use whole country", ZH: "选择整个国家", JA: "国全体を選択", VI: "Chọn toàn quốc" })}</button>}</div>{regionsLoading ? <div className="region-loading"><span className="spinner dark" /> {pickCopy(lang, { KR: "실제 지역 목록을 불러오는 중…", EN: "Loading real regional boundaries…", ZH: "正在加载真实地区…", JA: "地域一覧を読み込み中…", VI: "Đang tải danh sách khu vực…" })}</div> : regions.length ? <div className="region-grid">{regions.map(region => <button type="button" key={region.id} onClick={() => chooseRegion(region)}><b>{region.name}</b>{region.originalName && <span>{region.originalName}</span>}<small>ADM {region.adminLevel}</small></button>)}</div> : selectedCountryCode ? <div className="manual-region-entry"><p>{regionMessage || pickCopy(lang, { KR: "세부 지역 목록이 없어요. 방문할 도시나 지역명을 직접 입력해 주세요.", EN: "No subdivisions were returned. Enter the city or region you want to visit.", ZH: "未找到细分地区，请直接输入城市或地区名称。", JA: "地域一覧がありません。訪問する都市・地域名を入力してください。", VI: "Không có danh sách khu vực. Hãy nhập thành phố hoặc khu vực bạn muốn đến." })}</p><label><span>{pickCopy(lang, { KR: "직접 지역 입력", EN: "Enter a region", ZH: "输入地区", JA: "地域を入力", VI: "Nhập khu vực" })}</span><div><input value={manualRegion} onChange={event => setManualRegion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); chooseManualRegion(); } }} placeholder={pickCopy(lang, { KR: "예: 부산, 제주, 리옹", EN: "e.g. Busan, Jeju, Lyon", ZH: "例如：釜山、济州、里昂", JA: "例：釜山、済州、リヨン", VI: "VD: Busan, Jeju, Lyon" })} /><button type="button" disabled={!manualRegion.trim()} onClick={chooseManualRegion}>{pickCopy(lang, { KR: "이 지역 선택", EN: "Use this region", ZH: "选择此地区", JA: "この地域を選択", VI: "Chọn khu vực này" })}</button></div></label></div> : null}</section></Modal>}</>;
}

function PlanScreen({ lang, trip, profile, groups, placesLoading, placesSource, trendSource, plan, setPlan, savedPlans, onToggleSaved, onExplore, onRoute, onEdit }: { lang: Lang; trip: Trip; profile: Profile; groups: PlaceGroups; placesLoading: boolean; placesSource: string; trendSource: string; plan: PlanKey; setPlan: (plan: PlanKey) => void; savedPlans: SavedPlan[]; onToggleSaved: (plan: SavedPlan) => "saved" | "removed" | "limit"; onExplore: () => void; onRoute: () => void; onEdit: () => void }) {
  const u = ui[lang]; const [locked, setLocked] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [weatherResult, setWeatherResult] = useState<{ key: string; weather?: WeatherData; error?: string } | null>(null);
  const effectiveCoords = trip.coords ?? (profile.known ? profile.coords : undefined);
  const weatherRequest = effectiveCoords
    ? `/api/weather?lat=${encodeURIComponent(effectiveCoords[1])}&lng=${encodeURIComponent(effectiveCoords[0])}&lang=${lang}`
    : trip.destination
      ? `/api/weather?destination=${encodeURIComponent(trip.destination)}&lang=${lang}`
      : "";
  const weatherKey = weatherRequest;
  useEffect(() => {
    if (!weatherKey) return;
    const controller = new AbortController();
    fetch(weatherKey, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as WeatherData & { error?: string };
        if (!response.ok || typeof data.temp !== "number") throw new Error(data.error || "Weather request failed");
        setWeatherResult({ key: weatherKey, weather: data });
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") setWeatherResult({ key: weatherKey, error: lang === "KR" ? "현재 날씨를 불러오지 못했습니다." : "Current weather is temporarily unavailable." });
      });
    return () => controller.abort();
  }, [weatherKey, lang]);
  const weather = weatherResult?.key === weatherKey ? weatherResult.weather || null : null;
  const weatherError = weatherResult?.key === weatherKey ? weatherResult.error : "";
  const itinerary = useMemo(() => buildItinerary(groups, trip, plan), [groups, trip, plan]);
  const active = itinerary.visits;
  const route = usePlanRoute(itinerary.routeStops, lang);
  const storageId = savedPlanId(trip, plan);
  const isSaved = savedPlans.some(saved => saved.id === storageId);
  const fallbackDistanceMeters = itinerary.routeStops.slice(1).reduce((total, stop, index) => total + distanceKm(itinerary.routeStops[index], stop) * 1000, 0);
  const toggleSaved = () => {
    const result = onToggleSaved({
      id: storageId,
      savedAt: new Date().toISOString(),
      plan,
      destination: trip.resolvedName || trip.destination,
      country: trip.country || profile.country,
      dates: trip.dates,
      people: trip.people,
      accommodation: trip.accommodationResolvedName || trip.accommodation,
      styles: [...trip.styles],
      source: route?.source || placesSource || "Map data",
      stops: active.map(stop => ({
        id: stop.id,
        name: stop.name,
        address: stop.address,
        scheduledTime: stop.scheduledTime,
        role: stop.role,
        category: stop.category,
        rating: stop.rating,
        latitude: stop.location.latitude,
        longitude: stop.location.longitude,
      })),
      totalDistanceMeters: route?.totalDistanceMeters || fallbackDistanceMeters,
      totalDurationSeconds: route?.totalDurationSeconds || 0,
      totalTransfers: route?.totalTransfers ?? null,
      totalFare: route?.totalFare || null,
    });
    setSaveMessage(result === "limit"
      ? pickCopy(lang, { KR: "저장 가능한 플랜은 최대 10개입니다. 마이페이지에서 기존 플랜을 해제해 주세요.", EN: "You can save up to 10 plans. Remove one in My Page before saving another.", ZH: "最多可保存10个行程，请先在我的页面移除一个。", JA: "保存できるプランは最大10件です。マイページで1件解除してください。", VI: "Bạn có thể lưu tối đa 10 kế hoạch. Hãy xóa một kế hoạch trong trang cá nhân." })
      : result === "saved"
        ? pickCopy(lang, { KR: `PLAN ${plan}을 마이페이지에 저장했습니다.`, EN: `PLAN ${plan} was saved to My Page.`, ZH: `PLAN ${plan} 已保存到我的页面。`, JA: `PLAN ${plan}をマイページに保存しました。`, VI: `Đã lưu PLAN ${plan} vào trang cá nhân.` })
        : pickCopy(lang, { KR: `PLAN ${plan} 저장을 해제했습니다.`, EN: `PLAN ${plan} was removed from saved plans.`, ZH: `已取消保存 PLAN ${plan}。`, JA: `PLAN ${plan}の保存を解除しました。`, VI: `Đã bỏ lưu PLAN ${plan}.` }));
  };
  const names = { A: L("동선과 평점의 균형", "Balanced for route and ratings"), B: L("미식 다양성을 살린 하루", "A day led by diverse local flavors"), C: L("여유와 문화가 이어지는 하루", "A relaxed culture-focused day") };
  const temp = weather?.temp;
  const outfit = temp == null
    ? L("날씨 데이터가 도착하면 기온에 맞는 코디를 안내합니다.", "Outfit guidance appears when weather data arrives.")
    : temp <= 8
      ? L("따뜻한 코트와 니트, 방풍 레이어를 추천해요.", "Choose a warm coat, knit, and windproof layers.")
      : temp <= 18
        ? L("가벼운 재킷과 레이어드 셔츠가 좋아요.", "A light jacket and layered shirt will work well.")
        : L("통기성 좋은 옷과 햇빛 차단 아이템을 챙기세요.", "Pack breathable layers and sun protection.");
  const precipitationLabel = weather?.precipitationProbability != null
    ? `${weather.precipitationProbability}%`
    : weather?.precipitationAmount != null
      ? `${weather.precipitationAmount.toFixed(1)} mm`
      : "—";
  const windLabel = weather?.windSpeed != null ? `${Math.round(weather.windSpeed)} km/h` : "—";
  const todayLabel = weather?.localDate
    ? new Intl.DateTimeFormat(localeByLang[lang], { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${weather.localDate}T12:00:00`))
    : pickCopy(lang, { KR: "오늘", EN: "Today", ZH: "今天", JA: "今日", VI: "Hôm nay" });
  const temperatureRange = weather?.high != null || weather?.low != null
    ? `${pickCopy(lang, { KR: "최고", EN: "High", ZH: "最高", JA: "最高", VI: "Cao" })} ${weather?.high != null ? `${Math.round(weather.high)}°` : "—"} · ${pickCopy(lang, { KR: "최저", EN: "Low", ZH: "最低", JA: "最低", VI: "Thấp" })} ${weather?.low != null ? `${Math.round(weather.low)}°` : "—"}`
    : "—";
  const itineraryRuleTitle = itinerary.slowPace
    ? pickCopy(lang, { KR: "느긋한 일정 · 2km 이내 동선", EN: "Slow pace · route within 2 km", ZH: "悠闲行程 · 路线不超过2公里", JA: "ゆったり旅 · 2km以内", VI: "Lịch trình thư thả · trong 2 km" })
    : itinerary.maximizeStops
      ? pickCopy(lang, { KR: "최대한 많은 곳 · 2 + 4 + 2 방문", EN: "Maximum visits · 2 + 4 + 2 stops", ZH: "尽可能多地游览 · 2 + 4 + 2个地点", JA: "最大訪問 · 2 + 4 + 2スポット", VI: "Thăm nhiều nhất · 2 + 4 + 2 điểm" })
      : pickCopy(lang, { KR: "지역 분산 · 로컬 우선 일정", EN: "Region-spread · local-first itinerary", ZH: "区域分散 · 本地优先行程", JA: "地域分散 · ローカル優先", VI: "Phân bổ khu vực · ưu tiên địa phương" });
  const itineraryRuleDetail = itinerary.slowPace
    ? `${pickCopy(lang, { KR: "아침–점심 1곳 · 점심–저녁 1곳 · 숙소 왕복 직선거리 예산", EN: "1 stop before lunch · 1 before dinner · accommodation loop distance budget", ZH: "午餐前1处 · 晚餐前1处 · 住宿往返距离预算", JA: "昼食前1か所 · 夕食前1か所 · 宿泊先往復距離", VI: "1 điểm trước trưa · 1 điểm trước tối · ngân sách quãng đường khứ hồi" })} ${itinerary.loopDistanceKm.toFixed(1)} / ${itinerary.slowDistanceLimitKm.toFixed(1)} km`
    : itinerary.maximizeStops
      ? pickCopy(lang, { KR: "아침–점심 2곳 · 점심–저녁 4곳 · 저녁 이후 2곳을 영업시간과 동선에 맞춰 배치합니다.", EN: "Schedules 2 stops before lunch, 4 before dinner, and 2 after dinner around opening hours and route flow.", ZH: "根据营业时间与路线安排午餐前2处、晚餐前4处、晚餐后2处。", JA: "営業時間と動線に合わせ、昼食前2か所・夕食前4か所・夕食後2か所を配置します。", VI: "Sắp xếp 2 điểm trước trưa, 4 điểm trước tối và 2 điểm sau tối theo giờ mở cửa và lộ trình." })
      : `${trip.accommodationResolvedName || trip.accommodation} · ${pickCopy(lang, { KR: `체인 가능 매장 감점 · 플랜별 다른 권역 · Instagram ${trendSource ? "공식 신호 반영" : "연결 대기"}`, EN: `Likely-chain penalty · distinct plan zones · Instagram ${trendSource ? "official signal active" : "connection pending"}`, ZH: "降低连锁店优先级 · 各方案采用不同区域", JA: "チェーン候補を減点 · プランごとに異なるエリア", VI: "Giảm ưu tiên chuỗi · mỗi kế hoạch dùng khu vực khác nhau" })}`;
  return <main className="app-page plan-page"><section className="plan-hero glass-strong"><div><span className="eyebrow">{u.living} · {trip.dates}</span><h1>{t(lang, profile.city)}{u.inCity.split("\n").map((line, i) => <span key={line}>{i === 0 ? line : <><br /><em>{line}</em></>}</span>)}</h1><p>{trip.people}{lang === "KR" ? "명" : " travelers"} · {trip.styles.map(key => t(lang, styleLabels[key] || L(key, key))).join(" · ")}</p></div><div className="weather-orb"><span>{t(lang, profile.city)} · {weather ? weather.source : lang === "KR" ? "날씨 확인 중" : "checking weather"}</span><b>{temp == null ? "—" : `${Math.round(temp)}°`}</b><p>{weather ? `${weather.condition} · ${lang === "KR" ? "체감" : "feels"} ${Math.round(weather.feels)}°` : weatherError || (lang === "KR" ? "현재 기온을 불러오고 있어요" : "Loading current temperature")}</p><small>{t(lang, outfit)}</small></div></section>
    {weather && <section className="weather-strip glass" aria-label={pickCopy(lang, { KR: "오늘의 현재 날씨 상세 정보", EN: "Today’s current weather details", ZH: "今日实时天气详情", JA: "今日の現在の天気詳細", VI: "Chi tiết thời tiết hôm nay" })}><div className="today-temperature"><span>{todayLabel}</span><b>{temperatureRange}</b></div><div><span>{lang === "KR" ? "습도" : "Humidity"}</span><b>{weather.humidity != null ? `${weather.humidity}%` : "—"}</b></div><div><span>{lang === "KR" ? "강수" : "Precipitation"}</span><b>{precipitationLabel}</b></div><div><span>{lang === "KR" ? "바람" : "Wind"}</span><b>{windLabel}</b></div><div><span>{lang === "KR" ? "자외선" : "UV index"}</span><b>{weather.uvIndex ?? "—"}</b></div><div><span>{lang === "KR" ? "구름" : "Cloud cover"}</span><b>{weather.cloudCover != null ? `${weather.cloudCover}%` : "—"}</b></div><small>{weather.source}{weather.timeZone ? ` · ${weather.timeZone}` : ""}{weather.observedAt ? ` · ${new Date(weather.observedAt).toLocaleString(localeByLang[lang])}` : ""}</small></section>}
    {weatherError && <div className="data-notice weather-error" role="status"><i /><span>{weatherError}</span></div>}
    <AirportTransferPanel lang={lang} trip={trip} airports={groups.airports} />
    <div className="plan-tabs glass">{(["A", "B", "C", "D"] as const).map(key => <button type="button" key={key} aria-pressed={plan === key} className={plan === key ? "active" : ""} onClick={() => key === "D" ? setLocked(true) : setPlan(key)}><b>PLAN {key}</b><span>{key === "A" ? (lang === "KR" ? "균형형" : "Balanced") : key === "B" ? (lang === "KR" ? "미식형" : "Food-led") : key === "C" ? (lang === "KR" ? "느긋형" : "Slow") : "PRO"}</span>{key === "D" && <i>LOCK</i>}</button>)}</div>
    <section className="day-layout"><div className="day-main"><div className="section-title"><div><span>DAY 1 · 08:00–23:00 · PLAN {plan} · {placesSource || "LIVE PLACE DATA"}</span><h2>{t(lang, names[plan])}</h2></div><button type="button" className="soft-button" onClick={onRoute}>{u.fullRoute} ↝</button></div><div className="plan-rule-note glass"><b>{itineraryRuleTitle}</b><span>{itineraryRuleDetail}</span></div><div className="timeline">{placesLoading ? <div className="empty-state">{lang === "KR" ? "목적지 전체 권역의 로컬 장소와 최신 신호를 불러오는 중…" : "Loading local venues and current signals across the full destination…"}</div> : active.length < 2 ? <div className="empty-state">{lang === "KR" ? "이 목적지에서 충분한 실제 장소 데이터를 찾지 못했습니다. Google Maps API 키를 연결하면 카테고리별 추천과 영업시간 검증을 확장할 수 있어요." : "Not enough verified venue data was found here. Connect a Google Maps API key to expand categories and opening-hours checks."}</div> : active.map((item, index) => {
        const incomingLeg = route?.legs[itinerary.accommodation ? index : index - 1];
        return <article className={`timeline-card glass ${item.accommodationStop ? "accommodation-card" : ""}`} key={`${plan}-${item.id}`}><div className="timeline-time"><b>{item.scheduledTime}</b><span>{item.accommodationStop ? "FINISH" : index === 0 ? "START" : incomingLeg ? formatDuration(incomingLeg.durationSeconds, lang) : "…"}</span></div><div className={`place-visual visual-${index % 4 + 1}`}><PlaceImage place={item} /><span>{t(lang, item.role).toUpperCase()}</span></div><div className="timeline-copy"><div className="score-line"><span className="score">{item.rating != null ? `${(item.rating * 2).toFixed(1)}` : "—"}</span><span className="crowd">{item.accommodationStop ? (lang === "KR" ? "숙소 복귀" : "Return") : `★ ${item.rating?.toFixed(1) || "N/A"} · ${item.userRatingCount.toLocaleString(localeByLang[lang])}`}</span></div><h3>{item.name}</h3><p className="meta">{t(lang, item.role)} · {item.address}</p><p>{item.accommodationStop ? (lang === "KR" ? "하루 일정을 마치고 예약 숙소로 돌아옵니다." : "Finish the day by returning to the booked accommodation.") : item.source === "Google Places" ? (lang === "KR" ? `최근 30일 내 반환 리뷰 ${item.recentReviewCount}개 · ${item.hoursChecked ? "해당 시간 영업 확인" : "영업시간 데이터 미제공"}` : `${item.recentReviewCount} returned reviews in 30 days · ${item.hoursChecked ? "open at this time" : "opening hours unavailable"}`) : (lang === "KR" ? "지역 전체에서 분산 수집한 실제 장소 · 별점·리뷰는 Google 연결 후 제공" : "Real venue sampled across the region · ratings and reviews require Google")}</p>{item.cuisine && <p className="cuisine-note">{lang === "KR" ? "메뉴 유형" : "Cuisine"} · {item.cuisine}</p>}<div className="tags itinerary-tags">{!item.accommodationStop && !item.isLikelyChain && <i>{lang === "KR" ? "로컬 우선 후보" : "Local-first candidate"}</i>}{item.trendMentions > 0 && <i>Instagram · {item.trendMentions}</i>}</div><div className="mini-actions">{!item.accommodationStop && <button onClick={onExplore}>{u.placeInfo}</button>}{item.googleMapsUri && <a href={item.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a>}</div></div></article>;
      })}</div></div>
      <aside className="context-panel glass"><div className="context-map"><LocationMap center={trip.accommodationCoords || effectiveCoords} label={`${t(lang, profile.city)} · PLAN ${plan}`} lang={lang} routeCoordinates={route?.geometry || []} stops={mapStops(itinerary.routeStops)} airports={mapStops(groups.airports)} /><div className="map-caption"><b>{formatDistance(route?.totalDistanceMeters || 0)}</b><span>{formatDuration(route?.totalDurationSeconds || 0, lang)} · {route?.transitAvailable ? (lang === "KR" ? `${route.totalTransfers || 0}회 환승` : `${route.totalTransfers || 0} transfers`) : (lang === "KR" ? "도로 경로 대체" : "road fallback")}</span></div></div><div className="context-block"><span>ROUTE DATA</span><h3>{route?.source || (lang === "KR" ? "경로 계산 중…" : "Calculating route…")}</h3><p><i className="status-dot" /> {route?.transitAvailable ? (lang === "KR" ? `예상 요금 ${route.totalFare || "제공되지 않음"}` : `Estimated fare ${route.totalFare || "not provided"}`) : (lang === "KR" ? "Google 키 연결 시 실제 대중교통·환승·요금 제공" : "Connect Google for transit, transfers, and fare")}</p><button onClick={onRoute}>{u.fullRoute}</button></div><div className="context-block"><span>STYLE NOTE</span><h3>{lang === "KR" ? "날씨에 맞춘 코디" : "Weather-aware outfit"}</h3><p>{t(lang, outfit)}</p><div className="outfit"><i>LAYER</i><i>SHOES</i><i>WEATHER</i></div></div></aside></section>
    <div className="plan-actions glass"><div><span>{lang === "KR" ? "예상 교통비" : "Estimated transit fare"}</span><b>{route?.totalFare || (lang === "KR" ? "데이터 없음" : "Unavailable")} <small>/ {trip.people}{u.forPeople}</small></b></div><button type="button" className={`save-plan-button ${isSaved ? "saved" : ""}`} aria-pressed={isSaved} onClick={toggleSaved}><span aria-hidden="true">{isSaved ? "♥" : "♡"}</span>{isSaved ? pickCopy(lang, { KR: "저장됨", EN: "Saved", ZH: "已保存", JA: "保存済み", VI: "Đã lưu" }) : pickCopy(lang, { KR: "플랜 저장", EN: "Save plan", ZH: "保存行程", JA: "プラン保存", VI: "Lưu kế hoạch" })} <small>{savedPlans.length}/10</small></button><button type="button" className="soft-button" onClick={onEdit}>{u.planEdit}</button><button type="button" className="primary-small" onClick={() => setConfirmed(true)}>{confirmed ? u.confirmed : u.confirm}</button></div>
    {saveMessage && <p className="save-plan-message" role="status">{saveMessage}</p>}
    {locked && <Modal lang={lang} onClose={() => setLocked(false)}><span className="modal-icon">✦</span><h2>{lang === "KR" ? "Plan D부터는 더 깊게." : "Go deeper from Plan D."}</h2><p>{lang === "KR" ? "실시간 재계획과 무제한 대안 플랜은 PRO에서 이용할 수 있어요." : "PRO unlocks live replanning and unlimited alternatives."}</p><button className="primary-cta" onClick={() => setLocked(false)}>{lang === "KR" ? "PRO 살펴보기" : "Explore PRO"}</button></Modal>}
  </main>;
}

function ExploreScreen({ lang, trip, profile, groups, loading, source, notice, trendSource }: { lang: Lang; trip: Trip; profile: Profile; groups: PlaceGroups; loading: boolean; source: string; notice: string; trendSource: string }) {
  const u = ui[lang];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey>("attractions");
  const [selected, setSelected] = useState<LivePlace | null>(null);
  const [rating, setRating] = useState(9);
  const [reviewText, setReviewText] = useState("");
  const [reviewStore, setReviewStore] = useState<Record<string, Review[]>>({});
  const [reviewMessage, setReviewMessage] = useState("");
  const activePlaces = useMemo(() => groups[category].filter(place => `${place.name} ${place.address}`.toLowerCase().includes(query.toLowerCase())), [groups, category, query]);
  const exploreMapStops = useMemo(() => mapStops(activePlaces), [activePlaces]);
  const mapCenter = selected ? [selected.location.longitude, selected.location.latitude] as [number, number] : trip.coords ?? (profile.known ? profile.coords : undefined);
  const colors: Record<CategoryKey, string> = { attractions: "blue", restaurants: "amber", cafes: "violet", museums: "blue", hotels: "blue", parks: "green", shopping: "amber", theaters: "violet", airports: "violet" };
  const userReviews = selected ? reviewStore[selected.id] || [] : [];

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/reviews?placeId=${encodeURIComponent(selected.id)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as { reviews?: Review[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Review request failed");
        setReviewStore(current => ({ ...current, [selected.id]: data.reviews || [] }));
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") setReviewMessage(lang === "KR" ? "이용자 리뷰를 불러오지 못했습니다." : "Traveler reviews are temporarily unavailable.");
      });
    return () => controller.abort();
  }, [selected, lang]);

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !reviewText.trim()) return;
    setReviewMessage(lang === "KR" ? "리뷰를 저장하는 중…" : "Saving review…");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: selected.id, author: "Guest traveler", rating, content: reviewText.trim() }),
      });
      const data = await response.json() as { review?: Review; error?: string };
      if (!response.ok || !data.review) throw new Error(data.error || "Review could not be saved");
      setReviewStore(current => ({ ...current, [selected.id]: [data.review!, ...(current[selected.id] || [])] }));
      setReviewText("");
      setReviewMessage(lang === "KR" ? "리뷰가 저장되었습니다." : "Your review was saved.");
    } catch {
      setReviewMessage(lang === "KR" ? "리뷰를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." : "The review could not be saved. Please try again.");
    }
  };

  return <main className="app-page explore-page"><section className="page-heading"><span className="eyebrow">EXPLORE · {t(lang, profile.city).toUpperCase()} · {source || "MAP DATA"}</span><h1>{u.exploreTitle}</h1><p>{u.exploreBody}</p></section><div className="search-dock glass-strong"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder={u.search} aria-label={u.search} /><button type="button" disabled={!activePlaces.length} onClick={() => document.querySelector(".mini-map")?.scrollIntoView({ behavior: "smooth", block: "center" })}>{u.mapView}</button></div><div className="filter-row">{categoryKeys.map(key => <button key={key} className={category === key ? "active" : ""} onClick={() => { setCategory(key); setSelected(null); setReviewMessage(""); }}>{t(lang, categoryLabels[key])} <b>{groups[key].length}</b></button>)}</div>
    {notice && <div className={`data-notice ${source === "Google Places" ? "live" : ""}`}><i /> <span>{lang === "KR" ? (source === "Google Places" ? `목적지 전체를 여러 권역으로 나눠 검색하고 체인 가능 매장을 후순위로 둡니다. Instagram ${trendSource ? "공식 해시태그 신호가 반영되었습니다." : "공식 연결 전에는 소셜 인기도를 표시하지 않습니다."}` : "OpenStreetMap에서 지역 전체를 격자별로 분산 수집하고 체인 가능 매장을 후순위로 둡니다. 별점·Instagram 신호는 연결 전까지 표시하지 않습니다.") : notice}</span></div>}
    <section className="explore-layout"><div className="place-grid">{loading ? <div className="empty-state">{lang === "KR" ? "실제 장소를 검색하는 중…" : "Searching real venues…"}</div> : activePlaces.map(place => <article className="place-card glass" key={place.id} onClick={() => { setReviewMessage(""); setSelected(place); }}><div className={`place-photo photo-${colors[place.category]}`}><PlaceImage place={place} /><span>{t(lang, categoryLabels[place.category])}</span><div className="photo-label">{place.name}</div></div><div className="place-card-copy"><div className="score-line"><span className="score">{place.rating != null ? (place.rating * 2).toFixed(1) : "—"}</span><span>★ {place.rating?.toFixed(1) || "N/A"} · {place.userRatingCount.toLocaleString(localeByLang[lang])}</span></div><h3>{place.name}</h3>{place.originalName && <p className="original-name">{lang === "KR" ? "원문" : "Original"} · {place.originalName}</p>}<p className="venue-address">{place.address || t(lang, profile.city)}</p><div className="tags"><i>{place.source}</i><i className={place.isLikelyChain ? "chain-tag" : "local-tag"}>{place.isLikelyChain ? (lang === "KR" ? "체인 가능성 · 후순위" : "Likely chain · deprioritized") : (lang === "KR" ? "로컬 우선 후보" : "Local-first candidate")}</i>{place.trendMentions > 0 && <i className="trend-tag">Instagram · {place.trendMentions}</i>}{place.translationStatus === "source-language" && <i>{lang === "KR" ? "원문 표기" : "Source language"}</i>}{place.priceLevel && <i>{place.priceLevel.replaceAll("_", " ")}</i>}<i>{lang === "KR" ? `최근 리뷰 ${place.recentReviewCount}` : `${place.recentReviewCount} recent`}</i></div><div className="place-stats"><span>{lang === "KR" ? "Google 반환 리뷰" : "Google reviews"} {place.reviews.length}/5</span><span>{place.googleMapsUri ? "Maps ↗" : "—"}</span></div></div></article>)}{!loading && !activePlaces.length && <div className="empty-state">{lang === "KR" ? "이 카테고리에서 검증된 실제 장소를 찾지 못했습니다. Google Maps 키 연결 후 결과를 확장할 수 있어요." : "No verified venues were found in this category. Connect Google Maps to expand the results."}</div>}</div><aside className="mini-map glass"><LocationMap center={mapCenter} label={`${t(lang, categoryLabels[category])} · ${activePlaces.length}${lang === "KR" ? "곳" : " places"}`} lang={lang} stops={exploreMapStops} onSelectStop={id => { const place = activePlaces.find(candidate => candidate.id === id); if (place) { setReviewMessage(""); setSelected(place); } }} /><div className="map-key">{source || "Map data"} · {activePlaces.length} {lang === "KR" ? "개 위치" : "locations"}</div></aside></section>
    {selected && <Modal wide lang={lang} onClose={() => setSelected(null)}><div className="detail-hero"><PlaceImage place={selected} /><span>{selected.name}</span><b>{selected.rating != null ? (selected.rating * 2).toFixed(1) : "N/A"}</b></div><div className="detail-title"><div><span>{t(lang, categoryLabels[selected.category])} · {selected.source}</span><h2>{selected.name}</h2>{selected.originalName && <p>{lang === "KR" ? "원문" : "Original"} · {selected.originalName}</p>}<p>{selected.address}</p></div><div className="detail-links">{selected.googleMapsUri && <a className="soft-button" href={selected.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a>}</div></div><div className="detail-facts"><div><span>Google rating</span><b>{selected.rating != null ? `${selected.rating.toFixed(1)}/5` : "N/A"}</b></div><div><span>{lang === "KR" ? "전체 평가 수" : "Rating count"}</span><b>{selected.userRatingCount.toLocaleString(localeByLang[lang])}</b></div><div><span>{lang === "KR" ? "최근 30일 반환 리뷰" : "Returned reviews · 30d"}</span><b>{selected.recentReviewCount}</b></div><div><span>{u.lociScore}</span><b>{selected.rating != null ? `${(selected.rating * 2).toFixed(1)}/10` : "N/A"}</b></div></div><div className="review-section"><div className="section-title"><div><span>GOOGLE REVIEW SIGNALS</span><h3>{u.reviews}</h3></div><b>{selected.reviews.length} / 5</b></div>{selected.reviews.length ? selected.reviews.map((review, index) => <article className="review" key={`${review.author}-${index}`}><div><span className="avatar small">{review.author.slice(0, 2).toUpperCase()}</span><p><b>{review.author}</b><small>{review.relativeTime || review.publishTime}{isRecentReview(review.publishTime) && <em className="recent-badge">{lang === "KR" ? "최근 30일" : "Last 30 days"}</em>}</small></p></div><span className="review-score">{(review.rating * 2).toFixed(1)}</span><p>{review.text || (lang === "KR" ? "텍스트 없이 별점만 등록된 리뷰입니다." : "Rating-only review.")}</p></article>) : <div className="empty-state compact">{lang === "KR" ? "Google 리뷰 데이터가 없습니다. 임의 리뷰는 표시하지 않습니다." : "No Google review data is available; no synthetic reviews are shown."}</div>}{userReviews.map(review => <article className="review" key={review.id}><div><span className="avatar small">GT</span><p><b>{review.author}</b><small>{review.createdAt ? new Date(review.createdAt).toLocaleString(localeByLang[lang]) : u.justNow} · LOCI</small></p></div><span className="review-score">{review.rating.toFixed(1)}</span><p>{review.content}</p></article>)}<form className="review-form" onSubmit={submitReview}><label>{u.reviews} <span>{lang === "KR" ? "내 리뷰" : "Your review"}</span></label><div className="rating-input"><input type="range" min="1" max="10" step="0.5" value={rating} onChange={e => setRating(Number(e.target.value))} /><b>{rating.toFixed(1)}</b></div><textarea required value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder={u.reviewPlaceholder} />{reviewMessage && <p className="form-message" role="status">{reviewMessage}</p>}<button className="primary-small">{u.submitReview}</button></form></div></Modal>}
  </main>;
}

function RouteScreen({ lang, trip, profile, groups, plan }: { lang: Lang; trip: Trip; profile: Profile; groups: PlaceGroups; plan: "A" | "B" | "C" }) {
  const u = ui[lang]; const [preference, setPreference] = useState<"" | "FEWER_TRANSFERS" | "LESS_WALKING">(""); const itinerary = useMemo(() => buildItinerary(groups, trip, plan), [groups, trip, plan]); const stops = itinerary.routeStops; const route = usePlanRoute(stops, lang, preference);
  const preferenceLabels: Array<{ key: "" | "FEWER_TRANSFERS" | "LESS_WALKING"; label: Localized }> = [{ key: "", label: L("균형 추천", "Balanced") }, { key: "FEWER_TRANSFERS", label: L("최소 환승", "Fewer transfers") }, { key: "LESS_WALKING", label: L("최소 도보", "Less walking") }];
  const first = stops[0]; const last = stops.at(-1);
  return <main className="app-page route-page"><section className="page-heading"><span className="eyebrow">PLAN {plan} · MOBILITY · {t(lang, profile.city).toUpperCase()}</span><h1>{u.routeTitle.split("\n").map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1><p>{u.routeBody}</p></section>{first && last ? <><div className="route-search glass-strong"><div><span>{u.from}</span><b>{first.name}</b></div><i>→</i><div><span>{u.to}</span><b>{last.name}</b></div></div><div className="route-preferences">{preferenceLabels.map(item => <button key={item.key || "balanced"} className={preference === item.key ? "active" : ""} onClick={() => setPreference(item.key)}>{t(lang, item.label)}</button>)}</div>
    <section className="route-layout"><div className="route-list"><div className={`live-banner ${route?.transitAvailable ? "" : "warning"}`}><i /> {route ? `${route.source} · ${formatDuration(route.totalDurationSeconds, lang)} · ${formatDistance(route.totalDistanceMeters)}` : (lang === "KR" ? "실제 경로 계산 중…" : "Calculating the actual route…")}</div>{route?.legs.length ? route.legs.map((leg, index) => <article className="route-card glass selected" key={`${leg.from}-${leg.to}-${index}`}><div className="route-rank" style={{ background: "#7259ff" }}>{index + 1}</div><div className="route-core"><span>{leg.from} → {leg.to}</span><h3>{formatDuration(leg.durationSeconds, lang)} <small>{formatDistance(leg.distanceMeters)}</small></h3><div className="route-legs">{leg.steps.filter(step => step.mode === "TRANSIT" || step.instruction).map((step, stepIndex) => <span key={`${step.line}-${stepIndex}`}>{step.mode === "TRANSIT" ? `${step.line || (lang === "KR" ? "대중교통" : "Transit")} · ${step.stops}${lang === "KR" ? "정거장" : " stops"}` : (step.instruction || (lang === "KR" ? "도보 이동" : "Walk"))}<i>›</i></span>)}</div></div><div className="route-score"><b>{leg.transfers}</b><span>{leg.fare || (lang === "KR" ? "요금 미제공" : "Fare unavailable")}</span><small>{lang === "KR" ? "환승" : "transfers"}</small></div></article>) : <div className="empty-state">{route?.transitAvailable === false ? (lang === "KR" ? "Google Maps 키가 없어 실제 도로 형상만 표시합니다. 대중교통 소요시간·환승·요금은 임의로 만들지 않습니다." : "Without a Google Maps key, only the real road geometry is shown. Transit time, transfers, and fare are not fabricated.") : (lang === "KR" ? "대중교통 구간을 불러오는 중…" : "Loading transit legs…")}</div>}<div className="route-notes glass"><h3>{u.routeReason}</h3><ul><li>{lang === "KR" ? `예약 숙소에서 출발해 PLAN ${plan}의 실제 장소를 순서대로 방문한 뒤 23:00에 같은 숙소로 복귀합니다.` : `Starts at the booked accommodation, follows PLAN ${plan}, and returns to the same accommodation at 23:00.`}</li><li>{lang === "KR" ? "평점·리뷰 신뢰도와 직전 장소까지의 거리를 함께 계산하고, 식사 메뉴 유형의 중복을 피합니다." : "Balances rating confidence with distance from the previous stop and avoids repeated cuisine types."}</li><li>{lang === "KR" ? "Google Routes 연결 시 버스·지하철·열차 노선, 정거장 수, 환승과 제공 가능한 요금을 표시합니다." : "Google Routes adds transit lines, stop counts, transfers, and available fares."}</li></ul></div></div><div className="route-map glass"><LocationMap center={trip.accommodationCoords || trip.coords || (profile.known ? profile.coords : undefined)} label={`${t(lang, profile.city)} · PLAN ${plan}`} lang={lang} routeCoordinates={route?.geometry || []} stops={mapStops(stops)} /><div className="route-map-bottom"><div><span>{u.selectedRoute}</span><b>{formatDuration(route?.totalDurationSeconds || 0, lang)} · {route?.totalFare || (lang === "KR" ? "요금 미제공" : "Fare unavailable")} · {route?.totalTransfers ?? "—"} {lang === "KR" ? "환승" : "transfers"}</b></div><button className="primary-small">{u.startRoute}</button></div></div></section></> : <div className="empty-state">{lang === "KR" ? "숙소와 실제 장소 좌표를 불러온 뒤 경로를 계산할 수 있습니다." : "Accommodation and real venue coordinates are required before routing."}</div>}
  </main>;
}

function CommunityScreen({ lang, profile }: { lang: Lang; profile: Profile }) {
  const u = ui[lang];
  const initialRegion = (() => {
    try { return profile.countryCode !== "--" ? new Intl.DisplayNames(["en"], { type: "region" }).of(profile.countryCode) || profile.country : profile.country; }
    catch { return profile.country; }
  })();
  const [region, setRegion] = useState(initialRegion);
  const [regionCode, setRegionCode] = useState(profile.countryCode);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [compose, setCompose] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const regionKey = regionCode && regionCode !== "--" ? regionCode : region;
  const regionDisplay = useMemo(() => {
    if (!regionCode || regionCode === "--") return region;
    try { return new Intl.DisplayNames([localeByLang[lang]], { type: "region" }).of(regionCode) || region; }
    catch { return region; }
  }, [lang, region, regionCode]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/posts?region=${encodeURIComponent(regionKey)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as { posts?: Post[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Post request failed");
        const loaded = data.posts || [];
        setPosts(loaded);
        setOwnedIds(new Set(loaded.filter(post => Boolean(window.localStorage.getItem(`loci-post-token-${post.id}`))).map(post => post.id)));
        setLoading(false);
      })
      .catch(error => {
        if ((error as Error).name !== "AbortError") {
          setPosts([]);
          setLoading(false);
          setMessage(lang === "KR" ? "커뮤니티 글을 불러오지 못했습니다." : "Community posts are temporarily unavailable.");
        }
      });
    return () => controller.abort();
  }, [regionKey, lang]);

  const startCreate = () => { setEditingId(null); setTitle(""); setContent(""); setMessage(""); setCompose(true); };
  const startEdit = (post: Post) => { setEditingId(post.id); setTitle(post.title); setContent(post.content); setOpenMenuId(null); setMessage(""); setCompose(true); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setMessage(lang === "KR" ? "게시물을 저장하는 중…" : "Saving post…");
    try {
      if (editingId) {
        const editToken = window.localStorage.getItem(`loci-post-token-${editingId}`);
        if (!editToken) throw new Error("Ownership token unavailable");
        const response = await fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, title: title.trim(), content: content.trim(), editToken }),
        });
        const data = await response.json() as { post?: Post; error?: string };
        if (!response.ok || !data.post) throw new Error(data.error || "Update failed");
        setPosts(current => current.map(post => post.id === editingId ? data.post! : post));
      } else {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region: regionKey, author: "Guest traveler", title: title.trim(), content: content.trim() }),
        });
        const data = await response.json() as { post?: Post; editToken?: string; error?: string };
        if (!response.ok || !data.post || !data.editToken) throw new Error(data.error || "Create failed");
        window.localStorage.setItem(`loci-post-token-${data.post.id}`, data.editToken);
        setOwnedIds(current => new Set([...current, data.post!.id]));
        setPosts(current => [data.post!, ...current]);
      }
      setCompose(false);
      setEditingId(null);
      setMessage(lang === "KR" ? "게시물이 저장되었습니다." : "Post saved.");
    } catch {
      setMessage(lang === "KR" ? "게시물을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." : "The post could not be saved. Please try again.");
    }
  };
  const confirmDelete = async () => {
    if (deleteId === null) return;
    const editToken = window.localStorage.getItem(`loci-post-token-${deleteId}`);
    if (!editToken) { setDeleteId(null); setMessage(lang === "KR" ? "이 게시물을 삭제할 권한이 없습니다." : "You do not own this post."); return; }
    try {
      const response = await fetch(`/api/posts?id=${deleteId}&editToken=${encodeURIComponent(editToken)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setPosts(current => current.filter(post => post.id !== deleteId));
      window.localStorage.removeItem(`loci-post-token-${deleteId}`);
      setOwnedIds(current => new Set([...current].filter(id => id !== deleteId)));
      setMessage(lang === "KR" ? "게시물이 삭제되었습니다." : "Post deleted.");
    } catch {
      setMessage(lang === "KR" ? "게시물을 삭제하지 못했습니다." : "The post could not be deleted.");
    }
    setDeleteId(null);
    setOpenMenuId(null);
  };
  const postTime = (post: Post) => post.createdAt ? new Date(post.createdAt).toLocaleString(localeByLang[lang]) : (lang === "KR" ? "시간 정보 없음" : "Time unavailable");

  return <main className="app-page community-page"><section className="page-heading community-heading"><div><span className="eyebrow">THE WORLD, IN LOCAL VOICES</span><h1>{u.communityTitle.split("\n").map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1></div><button className="primary-small" onClick={startCreate}>{u.newPost}</button></section><WorldCommunityMap lang={lang} selectedCountry={region} selectedCode={regionCode} onSelectCountry={(country, code) => { setLoading(true); setMessage(""); setRegion(country); setRegionCode(code); setOpenMenuId(null); }} />
    <section className="community-feed"><div className="section-title"><div><span>{region.toUpperCase()} COMMUNITY</span><h2>{regionDisplay} {u.countryCommunity}</h2></div><span className="feed-status">{lang === "KR" ? "최신순" : "Newest first"}</span></div>{message && <p className="form-message" role="status">{message}</p>}<div className="feed-grid">{posts.map(post => <article className="post-card glass" key={post.id}><div className="post-top"><span className="avatar small">{post.author.slice(0, 2).toUpperCase()}</span><p><b>{post.author}</b><small>{postTime(post)}</small></p>{ownedIds.has(post.id) && <div className="post-menu-wrap"><button type="button" className="post-menu-trigger" aria-label={lang === "KR" ? "내 게시물 메뉴" : "My post menu"} aria-expanded={openMenuId === post.id} onClick={event => { event.stopPropagation(); setOpenMenuId(current => current === post.id ? null : post.id); }}>•••</button>{openMenuId === post.id && <div className="post-menu-dropdown glass-strong"><button type="button" onClick={() => startEdit(post)}>{u.edit}</button><button type="button" className="danger" onClick={() => { setDeleteId(post.id); setOpenMenuId(null); }}>{u.delete}</button></div>}</div>}</div><span className="post-tag"># {regionDisplay}</span><h3>{post.title}</h3><p>{post.content}</p>{post.likes > 0 && <div className="post-actions"><span>♡ {post.likes}</span></div>}</article>)}</div>{loading && <div className="empty-state">{lang === "KR" ? "게시물을 불러오는 중…" : "Loading posts…"}</div>}{!loading && !posts.length && <div className="empty-state">{u.firstStory}</div>}</section>
    {compose && <Modal lang={lang} onClose={() => setCompose(false)}><span className="eyebrow">WRITE TO {regionDisplay.toUpperCase()}</span><h2>{editingId ? u.edit : u.newPost}</h2><form className="compose-form" onSubmit={submit}><input required value={title} onChange={e => setTitle(e.target.value)} placeholder={u.postTitle} /><textarea required value={content} onChange={e => setContent(e.target.value)} placeholder={u.postBody} />{message && <p className="form-message" role="status">{message}</p>}<div><button type="button" className="soft-button" onClick={() => setCompose(false)}>{u.cancel}</button><button className="primary-small">{editingId ? u.save : u.publish}</button></div></form></Modal>}
    {deleteId !== null && <Modal lang={lang} onClose={() => setDeleteId(null)}><span className="modal-icon danger-icon">!</span><h2>{u.deleteAsk}</h2><p>{u.deleteExplain}</p><div className="confirm-actions"><button type="button" className="soft-button" onClick={() => setDeleteId(null)}>{u.cancel}</button><button type="button" className="danger-button" onClick={confirmDelete}>{u.delete}</button></div></Modal>}
  </main>;
}

function SavedPlansComparison({ lang, plans, onRemove }: { lang: Lang; plans: SavedPlan[]; onRemove: (id: string) => void }) {
  const labels = {
    title: pickCopy(lang, { KR: "저장한 여행 플랜 비교", EN: "Compare saved travel plans", ZH: "比较已保存的旅行计划", JA: "保存した旅行プランを比較", VI: "So sánh kế hoạch đã lưu" }),
    note: pickCopy(lang, { KR: "현재 게스트 세션에서는 이 기기에 최대 10개까지 저장됩니다.", EN: "In this guest session, up to 10 plans are stored on this device.", ZH: "访客模式下，最多可在此设备保存10个计划。", JA: "ゲストセッションでは、この端末に最大10件保存されます。", VI: "Trong phiên khách, tối đa 10 kế hoạch được lưu trên thiết bị này." }),
    empty: pickCopy(lang, { KR: "아직 저장한 플랜이 없습니다. 플랜 페이지에서 하트 버튼을 눌러 저장해 보세요.", EN: "No plans are saved yet. Use the heart button on the Plan page to save one.", ZH: "尚未保存计划，请在行程页面点击爱心按钮。", JA: "保存したプランはまだありません。プランページのハートを押してください。", VI: "Chưa có kế hoạch đã lưu. Hãy dùng nút trái tim ở trang Kế hoạch." }),
  };
  return <section className="saved-plans-section glass wide-card"><div className="saved-plans-heading"><div><span className="eyebrow">SAVED PLAN LAB · {plans.length}/10</span><h2>{labels.title}</h2><p>{labels.note}</p></div></div>{plans.length ? <div className="saved-plan-table-wrap"><table className="saved-plan-table"><thead><tr><th>{pickCopy(lang, { KR: "플랜", EN: "Plan", ZH: "计划", JA: "プラン", VI: "Kế hoạch" })}</th><th>{pickCopy(lang, { KR: "위치·동선", EN: "Locations & route", ZH: "地点与路线", JA: "場所・動線", VI: "Vị trí & lộ trình" })}</th><th>{pickCopy(lang, { KR: "거리", EN: "Distance", ZH: "距离", JA: "距離", VI: "Khoảng cách" })}</th><th>{pickCopy(lang, { KR: "소요시간", EN: "Duration", ZH: "时间", JA: "所要時間", VI: "Thời gian" })}</th><th>{pickCopy(lang, { KR: "환승", EN: "Transfers", ZH: "换乘", JA: "乗換", VI: "Chuyển tuyến" })}</th><th>{pickCopy(lang, { KR: "예상 요금", EN: "Fare", ZH: "费用", JA: "運賃", VI: "Giá vé" })}</th><th><span className="sr-only">{pickCopy(lang, { KR: "저장 해제", EN: "Remove", ZH: "移除", JA: "削除", VI: "Xóa" })}</span></th></tr></thead><tbody>{plans.map(saved => <tr key={saved.id}><td><b>PLAN {saved.plan}</b><span>{saved.destination}</span><small>{saved.dates} · {new Date(saved.savedAt).toLocaleDateString(localeByLang[lang])}</small></td><td><ol>{saved.stops.filter(stop => stop.category !== "hotels").slice(0, 8).map(stop => <li key={`${saved.id}-${stop.id}-${stop.scheduledTime}`}><time>{stop.scheduledTime}</time><span>{stop.name}</span></li>)}</ol><small>{saved.accommodation} ↔ {saved.stops.length} {pickCopy(lang, { KR: "개 지점", EN: "stops", ZH: "个地点", JA: "スポット", VI: "điểm" })}</small></td><td><b>{formatDistance(saved.totalDistanceMeters)}</b></td><td><b>{formatDuration(saved.totalDurationSeconds, lang)}</b></td><td><b>{saved.totalTransfers ?? "—"}</b></td><td><b>{saved.totalFare || "—"}</b><small>{saved.source}</small></td><td><button type="button" className="saved-plan-remove" aria-label={pickCopy(lang, { KR: `PLAN ${saved.plan} 저장 해제`, EN: `Remove PLAN ${saved.plan}`, ZH: `移除 PLAN ${saved.plan}`, JA: `PLAN ${saved.plan}を削除`, VI: `Xóa PLAN ${saved.plan}` })} onClick={() => onRemove(saved.id)}>♥</button></td></tr>)}</tbody></table></div> : <div className="empty-state">{labels.empty}</div>}</section>;
}

function ProfileScreen({ lang, trip, placesSource, savedPlans, onRemoveSaved }: { lang: Lang; trip: Trip; placesSource: string; savedPlans: SavedPlan[]; onRemoveSaved: (id: string) => void }) {
  const destination = trip.resolvedName || trip.destination;
  const styles = trip.styles.map(key => t(lang, styleLabels[key] || L(key, key))).join(" · ");
  const googleConnected = placesSource === "Google Places";
  return <main className="app-page profile-page"><section className="profile-card glass-strong"><div className="profile-identity"><span className="avatar xl">G</span><div><span>{lang === "KR" ? "게스트 세션" : "GUEST SESSION"}</span><h1>{lang === "KR" ? "현재 여행 정보" : "Current trip details"}</h1><p>{lang === "KR" ? "로그인 계정이 연결되지 않아 계정 정보는 표시하지 않으며, 저장 플랜은 이 기기에 보관됩니다." : "No account is connected; saved plans remain on this device and no fabricated account data is shown."}</p></div></div></section><section className="profile-grid"><SavedPlansComparison lang={lang} plans={savedPlans} onRemove={onRemoveSaved} /><article className="glass"><span className="eyebrow">{lang === "KR" ? "현재 여행" : "CURRENT TRIP"}</span><h2>{destination}</h2><p>{trip.dates}<br />{trip.people}{lang === "KR" ? "명" : " travelers"}{styles ? ` · ${styles}` : ""}</p><span className="profile-accommodation">{lang === "KR" ? "예약 숙소" : "Booked accommodation"} · {trip.accommodationResolvedName || trip.accommodation || (lang === "KR" ? "입력되지 않음" : "Not entered")}</span></article><article className="glass"><span className="eyebrow">{lang === "KR" ? "데이터 상태" : "DATA STATUS"}</span><h2>{placesSource || (lang === "KR" ? "데이터 확인 중" : "Checking data")}</h2><ul className="connection-list"><li><i className="ready" /> OpenStreetMap + MapLibre <b>{lang === "KR" ? "지도 사용 중" : "Map active"}</b></li><li><i className={googleConnected ? "ready" : ""} /> Google Places / Routes <b>{googleConnected ? (lang === "KR" ? "연결됨" : "Connected") : (lang === "KR" ? "키 미연결" : "Key not connected")}</b></li></ul></article><article className="glass wide-card"><span className="eyebrow">TRUST & TRANSPARENCY</span><h2>{lang === "KR" ? "점수와 데이터의 의미" : "What scores and data mean"}</h2><p>{lang === "KR" ? "현재 LOCI의 10점 점수는 데이터 제공자의 5점 별점을 10점 척도로 환산합니다. 제공되지 않은 별점, 리뷰, 요금, 기온은 임의 값으로 채우지 않으며 화면에 ‘데이터 없음’으로 표시합니다." : "LOCI currently converts the provider’s five-star rating to a ten-point scale. Missing ratings, reviews, fares, and temperatures are never invented; they are shown as unavailable."}</p></article></section></main>;
}

function Modal({ children, onClose, lang, wide = false }: { children: React.ReactNode; onClose: () => void; lang: Lang; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}><section className={`modal glass-strong ${wide ? "wide" : ""}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label={ui[lang].close}>×</button>{children}</section></div>;
}

export default function TravelApp() {
  const [screen, setScreen] = useState<Screen>("onboarding"); const [lang, setLang] = useState<Lang>("KR"); const [trip, setTrip] = useState<Trip>({ destination: "", accommodation: "", people: 1, dates: "", purpose: "", styles: [] }); const [groups, setGroups] = useState<PlaceGroups>(emptyPlaceGroups); const [placesLoading, setPlacesLoading] = useState(false); const [placesSource, setPlacesSource] = useState(""); const [placesNotice, setPlacesNotice] = useState(""); const [trendSource, setTrendSource] = useState(""); const [activePlan, setActivePlan] = useState<PlanKey>("A"); const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem("loci-saved-plans-v1") || "[]") as unknown;
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === "object" && typeof (item as SavedPlan).id === "string").slice(0, 10) as SavedPlan[] : [];
    } catch {
      return [];
    }
  });
  const profile = useMemo(() => {
    const base = destinationProfile(trip.destination);
    const resolvedCity = trip.resolvedName?.split(",")[0]?.trim();
    return {
      ...base,
      city: resolvedCity ? L(resolvedCity, resolvedCity) : base.city,
      country: trip.country || base.country,
      countryCode: trip.countryCode || base.countryCode,
    };
  }, [trip.destination, trip.resolvedName, trip.country, trip.countryCode]);
  const generated = screen !== "onboarding";
  useEffect(() => {
    window.localStorage.setItem("loci-saved-plans-v1", JSON.stringify(savedPlans.slice(0, 10)));
  }, [savedPlans]);
  useEffect(() => { if (!trip.destination) return; const controller = new AbortController(); fetch(`/api/geocode?q=${encodeURIComponent(trip.destination)}&lang=${lang}`, { signal: controller.signal }).then(response => response.json()).then(data => { if (typeof data.lng === "number" && typeof data.lat === "number") setTrip(current => current.destination === trip.destination ? { ...current, coords: [data.lng, data.lat], resolvedName: data.displayName, country: data.country, countryCode: data.countryCode, bounds: data.bounds, source: data.source } : current); }).catch(() => undefined); return () => controller.abort(); }, [trip.destination, lang]);
  useEffect(() => {
    if (!generated || !trip.accommodation) return;
    const query = `${trip.accommodation}, ${trip.destination}`;
    const controller = new AbortController();
    fetch(`/api/geocode?q=${encodeURIComponent(query)}&lang=${lang}`, { signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        if (typeof data.lng === "number" && typeof data.lat === "number") {
          setTrip(current => current.accommodation === trip.accommodation ? {
            ...current,
            accommodationCoords: [data.lng, data.lat],
            accommodationResolvedName: data.displayName,
          } : current);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [generated, trip.accommodation, trip.destination, lang]);
  const effectiveCoords = trip.coords ?? (profile.known ? profile.coords : undefined);
  useEffect(() => {
    if (!generated || !effectiveCoords) return;
    const controller = new AbortController(); const [lng, lat] = effectiveCoords;
    const region = trip.bounds ? `&south=${trip.bounds.south}&west=${trip.bounds.west}&north=${trip.bounds.north}&east=${trip.bounds.east}` : "";
    fetch(`/api/places?destination=${encodeURIComponent(trip.destination)}&country=${encodeURIComponent(trip.country || "")}&countryCode=${encodeURIComponent(trip.countryCode || "")}&lat=${lat}&lng=${lng}&lang=${lang}${region}`, { signal: controller.signal })
      .then(response => response.json())
      .then(data => { setGroups(data.groups || emptyPlaceGroups()); setPlacesSource(data.source || ""); setPlacesNotice(data.notice || data.error || ""); setTrendSource(data.trendSource || ""); setPlacesLoading(false); })
      .catch(() => { setGroups(emptyPlaceGroups()); setPlacesSource("unavailable"); setPlacesNotice(lang === "KR" ? "장소 데이터를 불러오지 못했습니다." : "Place data is temporarily unavailable."); setTrendSource(""); setPlacesLoading(false); });
    return () => controller.abort();
  }, [generated, effectiveCoords, trip.destination, trip.country, trip.countryCode, trip.bounds, lang]);
  const navigate = (next: Screen) => { setScreen(next); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" })); };
  const toggleSavedPlan = (saved: SavedPlan): "saved" | "removed" | "limit" => {
    if (savedPlans.some(item => item.id === saved.id)) {
      setSavedPlans(current => current.filter(item => item.id !== saved.id));
      return "removed";
    }
    if (savedPlans.length >= 10) return "limit";
    setSavedPlans(current => [saved, ...current].slice(0, 10));
    return "saved";
  };
  const page = screen === "plan" ? <PlanScreen lang={lang} trip={trip} profile={profile} groups={groups} placesLoading={placesLoading} placesSource={placesSource} trendSource={trendSource} plan={activePlan} setPlan={setActivePlan} savedPlans={savedPlans} onToggleSaved={toggleSavedPlan} onExplore={() => navigate("explore")} onRoute={() => navigate("route")} onEdit={() => navigate("onboarding")} /> : screen === "explore" ? <ExploreScreen lang={lang} trip={trip} profile={profile} groups={groups} loading={placesLoading} source={placesSource} notice={placesNotice} trendSource={trendSource} /> : screen === "route" ? <RouteScreen lang={lang} trip={trip} profile={profile} groups={groups} plan={activePlan} /> : screen === "community" ? <CommunityScreen lang={lang} profile={profile} /> : screen === "profile" ? <ProfileScreen lang={lang} trip={trip} placesSource={placesSource} savedPlans={savedPlans} onRemoveSaved={id => setSavedPlans(current => current.filter(item => item.id !== id))} /> : <Onboarding lang={lang} initial={trip} onGenerate={next => { setTrip({ ...next }); setGroups(emptyPlaceGroups()); setPlacesLoading(true); setPlacesSource(""); setPlacesNotice(""); setTrendSource(""); setActivePlan("A"); navigate("plan"); }} />;
  return <div className={`site-shell screen-${screen}`}><TopBar lang={lang} setLang={next => { if (generated) setPlacesLoading(true); setLang(next); }} onProfile={() => navigate("profile")} onHome={() => navigate("onboarding")} /><div className="screen-transition" key={screen}>{page}</div>{generated && <BottomNav lang={lang} screen={screen} setScreen={navigate} />}</div>;
}
