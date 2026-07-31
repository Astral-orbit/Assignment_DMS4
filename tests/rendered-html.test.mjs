import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("starts with user-supplied trip data instead of a fabricated profile", async () => {
  const app = await read("../app/travel-app.tsx");
  assert.match(app, /destination:\s*""[\s\S]*accommodation:\s*""[\s\S]*people:\s*1[\s\S]*dates:\s*""[\s\S]*purpose:\s*""[\s\S]*styles:\s*\[\]/);
  assert.doesNotMatch(app, /Daehui|seedPosts|댓글 8|8 comments|서울, 대한민국/);
  assert.match(app, /GUEST SESSION|게스트 세션/);
  assert.doesNotMatch(app, /01 · TRIP PROFILE|1 \/ 3|step-bar/);
});

test("requests localized map data and labels source-language fallbacks", async () => {
  const [app, geocode, places] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/geocode/route.ts"),
    read("../app/api/places/route.ts"),
  ]);
  assert.match(app, /api\/geocode\?q=.*&lang=/);
  assert.match(geocode, /Accept-Language/);
  assert.match(places, /namedetails/);
  assert.match(places, /translationStatus/);
  assert.match(app, /Source language|원문 표기/);
});

test("does not fabricate AI, review, or community data on failures", async () => {
  const [plan, posts, reviews] = await Promise.all([
    read("../app/api/plan/route.ts"),
    read("../app/api/posts/route.ts"),
    read("../app/api/reviews/route.ts"),
  ]);
  assert.doesNotMatch(plan, /demoPlan|central Seoul|demo intelligence/);
  assert.match(plan, /status:\s*503/);
  assert.match(posts, /editTokenHash/);
  assert.match(posts, /status:\s*403/);
  assert.match(reviews, /status:\s*503/);
});

test("connects localized current conditions to the trip weather panel", async () => {
  const [app, weather] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/weather/route.ts"),
  ]);
  assert.match(weather, /weather\.googleapis\.com\/v1\/currentConditions:lookup/);
  assert.match(weather, /weather\.googleapis\.com\/v1\/forecast\/days:lookup/);
  assert.match(weather, /languageCode/);
  assert.match(weather, /GOOGLE_WEATHER_API_KEY/);
  assert.match(weather, /resolveCoordinates/);
  assert.match(weather, /temperature_2m_max,temperature_2m_min/);
  assert.match(weather, /Open-Meteo fallback/);
  assert.match(app, /api\/weather\?lat=.*&lang=/);
  assert.match(app, /api\/weather\?destination=/);
  assert.match(app, /weather-strip/);
  assert.match(app, /temperatureRange/);
  assert.match(app, /Humidity|습도/);
});

test("packages the community ownership migration", async () => {
  const migration = await read("../drizzle/0001_loud_silvermane.sql");
  assert.match(migration, /edit_token_hash/);
  await access(new URL("../dist/.openai/drizzle/0001_loud_silvermane.sql", import.meta.url));
});

test("builds a hotel round-trip day with meal, cafe, culture, and evening rules", async () => {
  const [app, places, routes] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/places/route.ts"),
    read("../app/api/routes/route.ts"),
  ]);
  assert.match(app, /Booked accommodation name or address/);
  assert.match(app, /pick\(groups\.restaurants,\s*"08:00"/);
  assert.match(app, /pick\(groups\.restaurants,\s*"12:00"/);
  assert.match(app, /pick\(groups\.cafes,\s*"14:30"/);
  assert.match(app, /pick\(groups\.restaurants,\s*"18:00"/);
  assert.match(app, /scheduledTime:\s*"23:00"/);
  assert.match(app, /exclude:\s*\["parks",\s*"museums"\]/);
  assert.match(app, /cuisineKey/);
  assert.match(app, /isOpenAt/);
  assert.match(places, /regularOpeningHours/);
  assert.match(places, /locationRestriction/);
  assert.match(places, /places:searchNearby/);
  assert.match(routes, /slice\(0,\s*12\)/);
});

test("applies expanded travel styles to slow and maximum-visit schedules", async () => {
  const [app, places] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/places/route.ts"),
  ]);
  for (const style of [
    "themepark",
    "foodtour",
    "bars",
    "exotic",
    "maximize",
    "photo",
    "history",
    "wellness",
    "budget",
  ]) {
    assert.match(app, new RegExp(`${style}:\\s*L\\(`));
  }
  assert.match(app, /current\.length < 5/);
  assert.match(app, /slowDistanceLimitKm = 2/);
  assert.match(app, /travelledKm \+ nextDistance \+ returnDistance <= slowDistanceLimitKm/);
  assert.match(app, /pick\(morningCandidates,\s*"09:00"/);
  assert.match(app, /pick\(morningCandidates,\s*"10:20"/);
  assert.match(app, /pick\(afternoonCandidates,\s*"13:15"/);
  assert.match(app, /pick\(afternoonCandidates,\s*"17:00"/);
  assert.match(app, /pick\(eveningCandidates,\s*"19:30"/);
  assert.match(app, /pick\(eveningCandidates,\s*"21:00"/);
  assert.match(places, /theme parks and amusement parks/);
  assert.match(places, /restaurants bars and pubs/);
});

test("shows the nearest international airport and lets travelers choose another airport in the country", async () => {
  const [app, places, maps, routes] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/places/route.ts"),
    read("../app/world-maps.tsx"),
    read("../app/api/routes/route.ts"),
  ]);
  assert.match(app, /function AirportTransferPanel/);
  assert.match(app, /airports\.filter\(airport => airport\.isInternationalAirport\)/);
  assert.match(app, /distanceKm\(accommodation, a\) - distanceKm\(accommodation, b\)/);
  assert.match(app, /AirportTransferPanel[\s\S]*plan-tabs/);
  assert.match(app, /airports=\{mapStops\(\[selectedAirport\]\)\}/);
  assert.match(app, /setSelectedAirportId\(event\.target\.value\)/);
  assert.match(app, /FEWER_TRANSFERS/);
  assert.match(places, /international airports in/);
  assert.match(places, /international_airport/);
  assert.match(places, /groups\[key\] = groups\[key\]\.filter\(place => place\.isInternationalAirport\)/);
  assert.match(maps, /\[\.\.\.pointFeatures, \.\.\.airportFeatures\]/);
  assert.match(routes, /use the real road route when transit is unavailable/);
});

test("saves up to ten plans with heart controls and compares them in My Page", async () => {
  const app = await read("../app/travel-app.tsx");
  assert.match(app, /type SavedPlan =/);
  assert.match(app, /loci-saved-plans-v1/);
  assert.match(app, /savedPlans\.length >= 10/);
  assert.match(app, /savedPlans\.slice\(0,\s*10\)/);
  assert.match(app, /className=\{`save-plan-button/);
  assert.match(app, /aria-pressed=\{isSaved\}/);
  assert.match(app, /function SavedPlansComparison/);
  assert.match(app, /saved-plan-table/);
  assert.match(app, /totalDistanceMeters/);
  assert.match(app, /totalDurationSeconds/);
  assert.match(app, /totalTransfers/);
  assert.match(app, /totalFare/);
});

test("shows every filtered Explore venue on the map and supports marker selection", async () => {
  const [app, maps] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/world-maps.tsx"),
  ]);
  assert.match(app, /const exploreMapStops = useMemo\(\(\) => mapStops\(activePlaces\)/);
  assert.match(app, /stops=\{exploreMapStops\}/);
  assert.match(app, /onSelectStop=\{id =>/);
  assert.match(maps, /map\.on\("click", "trip-route-points"/);
  assert.match(maps, /properties:\s*\{\s*kind:\s*"stop",\s*id:/);
});

test("spreads discovery across the destination and deprioritizes likely chains", async () => {
  const [app, geocode, places] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/geocode/route.ts"),
    read("../app/api/places/route.ts"),
  ]);
  assert.match(geocode, /boundingbox/);
  assert.match(app, /bounds:\s*data\.bounds/);
  assert.match(app, /regionalAnchors/);
  assert.match(app, /place\.isLikelyChain\s*\?\s*-12/);
  assert.match(places, /regionCenters/);
  assert.match(places, /diverseSlice/);
  assert.match(places, /knownChainTokens/);
  assert.match(places, /repeated-brand-name/);
  assert.match(places, /Instagram Graph API/);
  assert.match(places, /ig_hashtag_search/);
  assert.match(places, /top_media/);
  assert.match(places, /INSTAGRAM_ACCESS_TOKEN/);
});

test("renders licensed place photos through the server-side Places media proxy", async () => {
  const [app, places, photos] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/places/route.ts"),
    read("../app/api/place-photo/route.ts"),
  ]);
  assert.match(places, /places\.photos/);
  assert.match(places, /photoAttribution/);
  assert.match(app, /function PlaceImage/);
  assert.match(app, /\/api\/place-photo\?name=/);
  assert.match(photos, /places\.googleapis\.com\/v1\/.*\/media/);
  assert.match(photos, /skipHttpRedirect/);
  assert.doesNotMatch(photos, /AIza/);
});

test("supports calendar ranges and a country-to-region destination picker", async () => {
  const [app, regions, maps] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/api/regions/route.ts"),
    read("../app/world-maps.tsx"),
  ]);
  assert.match(app, /type="date" value=\{startDate\}/);
  assert.match(app, /type="date" value=\{endDate\}/);
  assert.match(app, /api\/regions\?countryCode=/);
  assert.match(app, /WorldCommunityMap/);
  assert.match(app, /manualRegion/);
  assert.match(app, /chooseManualRegion/);
  assert.match(regions, /ISO3166-1/);
  assert.match(regions, /boundary.*administrative/);
  assert.match(maps, /Intl\.DisplayNames/);
});

test("adds five language choices and airport airplane markers", async () => {
  const [app, maps, places, routes, weather] = await Promise.all([
    read("../app/travel-app.tsx"),
    read("../app/world-maps.tsx"),
    read("../app/api/places/route.ts"),
    read("../app/api/routes/route.ts"),
    read("../app/api/weather/route.ts"),
  ]);
  assert.match(app, /type Lang = "KR" \| "EN" \| "ZH" \| "JA" \| "VI"/);
  assert.match(app, /中文/);
  assert.match(app, /日本語/);
  assert.match(app, /Tiếng Việt/);
  assert.match(places, /googleType:\s*"airport"/);
  assert.match(maps, /"text-field":\s*"✈"/);
  assert.match(app, /airports=\{mapStops\(groups\.airports\)\}/);
  assert.match(routes, /ZH:\s*"zh-CN"/);
  assert.match(weather, /VI:\s*"vi"/);
});
