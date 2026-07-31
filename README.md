# LOCI — AI Trip Conductor

지도·장소·교통·날씨 데이터를 결합해 실제 목적지에 맞는 여행 일정과 이동 동선을 추천하는 풀스택 여행 플래너입니다.

LOCI is a full-stack travel planner that combines maps, places, transit, and weather data to recommend destination-specific itineraries and routes.

## 주요 기능 · Highlights

- 한국어·영어·중국어·일본어·베트남어 전환과 목적지·숙소·인원·15가지 여행 스타일 설문(최대 5개 선택)
- 캘린더 시작/종료일 선택과 세계지도 국가→실제 행정지역 선택, 목록 미제공 시 지역 직접 입력
- 실제 장소 기반 PLAN A/B/C 추천과 숙소 출발·복귀 일정
- 느긋한 일정의 2km 직선거리 동선 제한과 최대 방문 일정의 오전 2곳·오후 4곳·야간 2곳 구성
- PLAN A/B/C 앞에서 가장 가까운 국제공항→입력 숙소의 거리·시간·환승·요금·지도 경로 제공
- 동일 국가의 다른 국제공항으로 출발지를 변경하는 거리순 공항 선택기
- 하트 버튼으로 최대 10개 플랜을 기기에 저장하고 마이페이지에서 장소·동선·거리·시간·환승·요금 비교
- 식사, 카페, 문화시설, 공원, 야간 방문 시간 규칙
- Google Places 사진·저작자 표시·별점·리뷰·영업시간과 로컬 우선 추천
- Google Routes 대중교통 소요시간, 거리, 환승, 정거장과 제공 가능한 요금
- Google Weather 기반 현재·체감·일 최고·최저기온과 여행 코디 안내
- MapLibre 지도 위 장소 마커, 비행기 아이콘 공항 위치와 플랜별 경로 시각화
- 목적지별 리뷰와 세계지도 기반 커뮤니티
- Korean, English, Chinese, Japanese, and Vietnamese UI; real-place photos and recommendations; transit routing; live weather; maps; reviews; and destination communities

## 기술 구성 · Stack

- Next.js 16, React 19, TypeScript
- vinext and Cloudflare Workers
- MapLibre GL
- Cloudflare D1 and Drizzle ORM
- Google Places API (New), Routes API, Geocoding API, Weather API
- OpenStreetMap, Nominatim, Overpass, and OSRM fallbacks

## 로컬 실행 · Local development

Node.js `>=22.13.0`이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` or the URL printed by the development server.

## 환경 변수 · Environment variables

```dotenv
GOOGLE_MAPS_API_KEY=
GOOGLE_WEATHER_API_KEY=
OPENROUTER_API_KEY=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_USER_ID=
INSTAGRAM_GRAPH_API_VERSION=v23.0
```

- `GOOGLE_MAPS_API_KEY` enables Places, Routes, Geocoding, and Weather unless a separate weather key is supplied.
- Enable Places API (New), Routes API, Geocoding API, and Weather API in the same Google Cloud project.
- Restrict production keys to only the required APIs and configure quotas. Never commit real keys.
- Instagram variables are optional and require an authorized Instagram Graph API account.
- Without optional providers, LOCI clearly labels and uses OpenStreetMap/OSRM fallbacks instead of inventing data.

## 검증 · Validation

```bash
npm run lint
npm test
npm run build
```

## 데이터 투명성 · Data transparency

- Google Places API (New) returns at most five relevance-ranked reviews per place. LOCI marks which returned reviews were published within the last 30 days; it does not claim to provide the complete monthly review history.
- Transit fares are displayed only when Google Routes supplies them.
- Missing ratings, reviews, fares, temperatures, and account activity are shown as unavailable rather than filled with synthetic values.
- 사용자 작성 리뷰와 커뮤니티 글은 D1에 저장됩니다.

## 배포 · Deployment

The project builds to a Cloudflare Worker-compatible vinext output. Runtime secrets must be configured in the hosting environment rather than committed to the repository.

현재 배포: [LOCI — AI Trip Conductor](https://loci-trip-conductor.astrally1022.chatgpt.site)

## GitHub와 Live 사이트 · GitHub and live site

- 이 저장소에는 LOCI의 전체 풀스택 배포 소스가 포함됩니다.
- `Validate LOCI` GitHub Actions 워크플로가 Pull Request와 `main` 브랜치 변경 시 린트·빌드·자동 검사를 실행합니다.
- 서버 API와 D1 데이터베이스가 필요하므로 정적 GitHub Pages만으로는 전체 기능을 실행할 수 없습니다.
- GitHub repository contains the complete deployable source. GitHub Actions validates every pull request and change to `main`.
- Static GitHub Pages cannot host the complete application because LOCI requires Worker API routes and D1.

**Live URL:** [https://loci-trip-conductor.astrally1022.chatgpt.site](https://loci-trip-conductor.astrally1022.chatgpt.site)
