"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

type Lang = "KR" | "EN" | "ZH" | "JA" | "VI";
type CountryOption = { en: string; localized: string; code: string; mapName?: string };
type MapStop = { id?: string; name: string; coordinates: [number, number]; kind?: "stop" | "airport" };

const localeByLang: Record<Lang, string> = { KR: "ko", EN: "en", ZH: "zh-CN", JA: "ja", VI: "vi" };
const mapCopy = {
  KR: { country: "국가 선택", count: "개 국가·지역", loadingCountries: "국가 목록 불러오는 중", mapLabel: "국가를 선택할 수 있는 세계지도", loadingMap: "세계지도를 불러오는 중…", instruction: "지도를 확대하고 국가 경계를 클릭하세요", map: "지도", locating: "목적지 좌표를 확인하는 중…", context: "실제 지도 기반" },
  EN: { country: "Choose a country", count: "countries & territories", loadingCountries: "Loading countries", mapLabel: "Interactive world map for country selection", loadingMap: "Loading the world map…", instruction: "Zoom the map and click any country boundary", map: "map", locating: "Locating your destination…", context: "Live map context" },
  ZH: { country: "选择国家或地区", count: "个国家和地区", loadingCountries: "正在加载国家列表", mapLabel: "可选择国家的互动世界地图", loadingMap: "正在加载世界地图…", instruction: "缩放地图并点击国家边界", map: "地图", locating: "正在定位目的地…", context: "实时地图信息" },
  JA: { country: "国・地域を選択", count: "か国・地域", loadingCountries: "国一覧を読み込み中", mapLabel: "国を選択できる世界地図", loadingMap: "世界地図を読み込み中…", instruction: "地図を拡大して国境をクリックしてください", map: "地図", locating: "目的地を検索中…", context: "リアルマップ情報" },
  VI: { country: "Chọn quốc gia", count: "quốc gia và vùng lãnh thổ", loadingCountries: "Đang tải danh sách quốc gia", mapLabel: "Bản đồ thế giới tương tác để chọn quốc gia", loadingMap: "Đang tải bản đồ thế giới…", instruction: "Phóng to và chọn ranh giới quốc gia", map: "bản đồ", locating: "Đang xác định điểm đến…", context: "Dữ liệu bản đồ trực tiếp" },
} satisfies Record<Lang, Record<string, string>>;

const rasterStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export function WorldCommunityMap({
  lang,
  selectedCountry,
  selectedCode,
  onSelectCountry,
}: {
  lang: Lang;
  selectedCountry: string;
  selectedCode: string;
  onSelectCountry: (country: string, code: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectCountry);
  const selectedRef = useRef(selectedCountry);
  const selectedCodeRef = useRef(selectedCode);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [ready, setReady] = useState(false);
  const copy = mapCopy[lang];

  useEffect(() => { onSelectRef.current = onSelectCountry; }, [onSelectCountry]);
  useEffect(() => { selectedRef.current = selectedCountry; }, [selectedCountry]);
  useEffect(() => { selectedCodeRef.current = selectedCode; }, [selectedCode]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      const response = await fetch("/world-countries.geojson");
      const geojson = await response.json() as {
        features: Array<{ properties: { ADMIN?: string; NAME_KO?: string; ISO_A2?: string } }>;
      };
      if (cancelled || !container.current) return;

      const boundaries = new Map(geojson.features.map(feature => [feature.properties.ISO_A2, {
        mapName: feature.properties.ADMIN,
        ko: feature.properties.NAME_KO,
      }]));
      const boundariesByName = new Map(geojson.features.map(feature => [feature.properties.ADMIN, {
        mapName: feature.properties.ADMIN,
        ko: feature.properties.NAME_KO,
      }]));
      const enNames = new Intl.DisplayNames(["en"], { type: "region" });
      const localizedNames = new Intl.DisplayNames([localeByLang[lang]], { type: "region" });
      const options: CountryOption[] = [];
      for (let first = 65; first <= 90; first += 1) {
        for (let second = 65; second <= 90; second += 1) {
          const code = String.fromCharCode(first, second);
          const en = enNames.of(code);
          if (!en || en === code) continue;
          const boundary = boundaries.get(code) || boundariesByName.get(en);
          options.push({ code, en, localized: localizedNames.of(code) || boundary?.ko || en, mapName: boundary?.mapName });
        }
      }
      options.sort((a, b) => a.en.localeCompare(b.en));
      setCountries(options);

      const map = new maplibregl.Map({
        container: container.current,
        style: rasterStyle,
        center: [12, 18],
        zoom: 1.25,
        minZoom: 1,
        maxZoom: 7,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("countries", { type: "geojson", data: geojson as never, generateId: true });
        map.addLayer({
          id: "countries-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": "#7259ff",
            "fill-opacity": ["case", ["any", ["==", ["get", "ISO_A2"], selectedCodeRef.current], ["==", ["get", "ADMIN"], selectedRef.current]], 0.34, 0.035],
          },
        });
        map.addLayer({
          id: "countries-line",
          type: "line",
          source: "countries",
          paint: { "line-color": "rgba(76,58,170,.55)", "line-width": 0.7 },
        });
        map.on("mouseenter", "countries-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "countries-fill", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", "countries-fill", (event) => {
          const country = event.features?.[0]?.properties?.ADMIN as string | undefined;
          const code = event.features?.[0]?.properties?.ISO_A2 as string | undefined;
          const matched = options.find(option => option.mapName === country || option.en === country);
          if (country) onSelectRef.current(country, matched?.code || (code && code !== "-99" ? code : "--"));
        });
        setReady(true);
      });
    })().catch(() => setReady(false));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lang]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("countries-fill")) return;
    map.setPaintProperty("countries-fill", "fill-opacity", ["case", ["any", ["==", ["get", "ISO_A2"], selectedCode], ["==", ["get", "ADMIN"], selectedCountry]], 0.34, 0.035]);
  }, [selectedCountry, selectedCode, ready]);

  return (
    <section className="real-world-map glass-strong">
      <div className="world-map-toolbar glass">
        <label htmlFor="country-select">{copy.country}</label>
        <select id="country-select" value={selectedCode} onChange={(e) => {
          const country = countries.find(option => option.code === e.target.value);
          if (country) onSelectCountry(country.mapName || country.en, country.code);
        }}>
          <option value="" disabled>{copy.country}</option>
          {countries.map((country) => <option key={`${country.code}-${country.en}`} value={country.code}>{country.localized}</option>)}
        </select>
        <span>{countries.length ? `${countries.length} ${copy.count}` : copy.loadingCountries}</span>
      </div>
      <div ref={container} className="map-host world-map-host" aria-label={copy.mapLabel} />
      {!ready && <div className="map-loading">{copy.loadingMap}</div>}
      <div className="map-instruction glass">{copy.instruction}</div>
    </section>
  );
}

export function LocationMap({
  center,
  label,
  lang,
  routeCoordinates = [],
  stops = [],
  airports = [],
  onSelectStop,
}: {
  center?: [number, number];
  label: string;
  lang: Lang;
  routeCoordinates?: Array<[number, number]>;
  stops?: MapStop[];
  airports?: MapStop[];
  onSelectStop?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onSelectStopRef = useRef(onSelectStop);

  useEffect(() => { onSelectStopRef.current = onSelectStop; }, [onSelectStop]);

  useEffect(() => {
    if (!container.current || !center) return;
    let map: MapLibreMap | null = null;
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      map = new maplibregl.Map({
        container: container.current,
        style: rasterStyle,
        center,
        zoom: 11.8,
        minZoom: 2,
        maxZoom: 17,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (!map) return;
        const line = routeCoordinates.length >= 2 ? routeCoordinates : [];
        const pointFeatures = stops.filter(stop => stop.kind !== "airport").map((stop, index) => ({
          type: "Feature" as const,
          properties: { kind: "stop", id: stop.id || "", index: index + 1, name: stop.name },
          geometry: { type: "Point" as const, coordinates: stop.coordinates },
        }));
        const airportStops = [...stops.filter(stop => stop.kind === "airport"), ...airports];
        const uniqueAirports = [...new Map(airportStops.map(stop => [`${stop.id || stop.name}:${stop.coordinates.join(",")}`, stop])).values()];
        const airportFeatures = uniqueAirports.map(airport => ({
          type: "Feature" as const,
          properties: { kind: "airport", id: airport.id || "", name: airport.name },
          geometry: { type: "Point" as const, coordinates: airport.coordinates },
        }));
        if (!line.length && !pointFeatures.length && !airportFeatures.length) return;
        map.addSource("trip-route", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              ...(line.length ? [{ type: "Feature" as const, properties: { kind: "route" }, geometry: { type: "LineString" as const, coordinates: line } }] : []),
              ...pointFeatures,
              ...airportFeatures,
            ],
          },
        });
        if (line.length) map.addLayer({ id: "trip-route-line", type: "line", source: "trip-route", filter: ["==", ["get", "kind"], "route"], paint: { "line-color": "#7259ff", "line-width": 5, "line-opacity": .9 } });
        if (pointFeatures.length) {
          map.addLayer({ id: "trip-route-points", type: "circle", source: "trip-route", filter: ["==", ["get", "kind"], "stop"], paint: { "circle-radius": 8, "circle-color": "#10231f", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
          map.addLayer({ id: "trip-route-labels", type: "symbol", source: "trip-route", filter: ["==", ["get", "kind"], "stop"], layout: { "text-field": ["to-string", ["get", "index"]], "text-size": 10 }, paint: { "text-color": "#fff" } });
          map.on("mouseenter", "trip-route-points", (event) => {
            map!.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;
            new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 13, className: "place-map-popup" })
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setText(String(feature.properties?.name || ""))
              .addTo(map!);
          });
          map.on("mouseleave", "trip-route-points", () => {
            map!.getCanvas().style.cursor = "";
            document.querySelectorAll(".place-map-popup").forEach(element => element.remove());
          });
          map.on("click", "trip-route-points", (event) => {
            const id = String(event.features?.[0]?.properties?.id || "");
            if (id) onSelectStopRef.current?.(id);
          });
        }
        if (airportFeatures.length) {
          map.addLayer({
            id: "airport-backgrounds",
            type: "circle",
            source: "trip-route",
            filter: ["==", ["get", "kind"], "airport"],
            paint: {
              "circle-radius": 14,
              "circle-color": "rgba(255,255,255,.94)",
              "circle-stroke-color": "#5943d5",
              "circle-stroke-width": 2,
            },
          });
          map.addLayer({
            id: "airport-icons",
            type: "symbol",
            source: "trip-route",
            filter: ["==", ["get", "kind"], "airport"],
            layout: {
              "text-field": "✈",
              "text-size": 17,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: { "text-color": "#5943d5" },
          });
          map.on("mouseenter", "airport-icons", (event) => {
            map!.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== "Point") return;
            new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 19, className: "place-map-popup" })
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setText(`✈ ${String(feature.properties?.name || "")}`)
              .addTo(map!);
          });
          map.on("mouseleave", "airport-icons", () => {
            map!.getCanvas().style.cursor = "";
            document.querySelectorAll(".place-map-popup").forEach(element => element.remove());
          });
          map.on("click", "airport-icons", (event) => {
            const id = String(event.features?.[0]?.properties?.id || "");
            if (id) onSelectStopRef.current?.(id);
          });
        }
        const boundsCoordinates = line.length ? line : [...pointFeatures, ...airportFeatures].map(feature => feature.geometry.coordinates);
        if (boundsCoordinates.length > 1) {
          const bounds = boundsCoordinates.reduce((bounds, coordinate) => bounds.extend(coordinate), new maplibregl.LngLatBounds(boundsCoordinates[0], boundsCoordinates[0]));
          map.fitBounds(bounds, { padding: 55, maxZoom: 14, duration: 0 });
        }
      });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [center, routeCoordinates, stops, airports]);

  const copy = mapCopy[lang];
  return (
    <div className="location-map-shell">
      <div ref={container} className="map-host location-map-host" aria-label={`${label} ${copy.map}`} />
      {!center && <div className="map-loading">{copy.locating}</div>}
      <div className="location-map-label glass"><b>{label}</b><span>{copy.context}</span></div>
    </div>
  );
}
