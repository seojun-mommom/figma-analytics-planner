# Amplitude event Mapper — Figma Plugin

## 프로젝트 개요

Figma 디자인 화면에 Amplitude 이벤트 레이블을 시각적으로 생성·관리하는 Figma 플러그인.
`create-figma-plugin` 프레임워크 기반, UI는 Preact + TypeScript.

---

## 아키텍처

Figma 플러그인은 **두 개의 격리된 런타임**으로 동작한다. 두 런타임은 메시지 버스(`emit`/`on`)로만 통신한다.

```
┌──────────────────────────────────────────────────────────┐
│  Main (샌드박스)           UI (iframe)                    │
│  src/entries/*.ts    ←→   src/views/ui.tsx               │
│  src/lib/*.ts              src/views/*/                   │
│  Figma API 직접 접근        Preact 컴포넌트                │
└──────────────────────────────────────────────────────────┘
```

### 빌드 설정 (`package.json` → `figma-plugin.menu`)

각 메뉴 항목이 별도의 Main 진입점을 가지며, UI는 단일 `ui.tsx`를 공유한다.

| 메뉴 항목 | Main 진입점 | 열리는 탭 |
|---|---|---|
| Create Event Label | `src/entries/addEvent.ts` | `Tab.ADD_EVENT` |
| View or Export Events | `src/entries/allEvents.ts` | `Tab.ALL_EVENTS` |
| Tutorial | `src/entries/tutorial.ts` | `Tab.TUTORIAL` |

> `src/entries/settings.ts`는 현재 menu에 등록되지 않아 빌드에 포함되지 않는다.

---

## 디렉터리 구조

```
src/
├── entries/          # Figma Main 런타임 진입점 (메뉴 항목 1개 = 파일 1개)
│   ├── addEvent.ts   # attachHandlers → loadInitialData → showUI(ADD_EVENT)
│   ├── allEvents.ts  # attachHandlers → loadInitialData → showUI(ALL_EVENTS)
│   ├── tutorial.ts   # attachHandlers → loadInitialData → showUI(TUTORIAL)
│   └── settings.ts   # 미사용 (menu 미등록)
├── lib/
│   ├── handlers.ts   # Main에서 UI 메시지 수신 핸들러 등록 (on())
│   ├── loader.ts     # clientStorage + 현재 페이지 이벤트 복원
│   ├── draw.ts       # Figma 캔버스에 이벤트 레이블 프레임/벡터 생성
│   └── color.ts      # 색상 상수
├── views/
│   ├── ui.tsx        # Plugin 루트 컴포넌트, 탭 상태 관리
│   ├── AddEvent/     # 이벤트 입력 폼 (이름, 트리거, 설명, 노트)
│   ├── AllEvents/    # 이벤트 목록 + CSV 내보내기
│   └── Tutorial/     # 사용 가이드
├── types/
│   ├── tab.ts        # Tab enum, 창 크기 상수
│   ├── message.ts    # Message enum (UI↔Main 통신 키)
│   └── event.ts      # EventMetadata, Trigger, NodeMarker, PluginData
├── services/
│   └── csv.ts        # CSV 문자열 생성 및 브라우저 다운로드
└── assets/           # SVG 아이콘, 이미지
```

---

## 핵심 데이터 흐름

### 이벤트 생성
```
UI: emit(ADD_EVENT, EventMetadata)
  → Main: createLabel(event, selectedNode)
      → Figma 캔버스에 FrameNode + VectorNode(bracket) 생성
      → group.setPluginData('eventMetadata', JSON)  ← 노드 ID 맵 저장
      → addToAmplitudeGroup()  ← "Amplitude Event Labels" 그룹에 추가
```

### 이벤트 복원 (플러그인 재실행 시)
```
loadEvents()
  → figma.currentPage.getPluginData('event_group') 로 그룹 노드 찾기
  → 각 child의 pluginData('eventMetadata') 파싱
  → NodeMarker로 실제 텍스트 노드 ID 조회 → characters 읽기
  → EventMetadata[] 반환
```

### 탭 전환 시 창 크기 조정
```
UI: emit(CHANGE_TAB, prevTab, nextTab)
  → Main: figma.ui.resize(width, height)  ← TAB_OPTIONS 기준
```

---

## 타입 핵심 개념

**`EventMetadata`** — 이벤트 하나의 데이터 단위
```ts
{ name: string; trigger: Trigger; description: string; notes: string; }
```

**`NodeMarker`** — Figma 노드에 붙이는 플러그인 데이터 키
```ts
enum NodeMarker { NAME, TRIGGER, DESCRIPTION, NOTES }
```

**`PluginData`** — 각 NodeMarker → 해당 텍스트 노드 ID 매핑 (JSON으로 직렬화)

**`Message`** — UI↔Main 통신 이벤트 타입
```ts
ADD_EVENT | API_KEY | SECRET_KEY | EXPORT_CSV | CHANGE_TAB | NOTIFY_MESSAGE
```

---

## 기존 CSV Export 동작

`AllEvents` 탭 → "Export to CSV" 버튼 → `services/csv.ts`의 `exportToCsv()` 호출.
현재 컬럼: `Event`, `Trigger`, `Event Description`, `Dev Notes`.

---

## 추가 기능 계획

### 1. Amplitude CSV/JSON Import

Amplitude Taxonomy에서 내보낸 CSV 또는 JSON 파일을 플러그인 안으로 가져오기.

- **진입점**: `AllEvents` 탭 또는 신규 `Import` 탭에 파일 업로드 UI 추가
- **파싱**: UI 런타임에서 파일을 읽어 `EventMetadata[]`로 변환, Main에 전달
- **고려사항**: Amplitude CSV 컬럼 스키마 파악 필요 (Event Name, Description, Category 등)
- **새 파일**: `src/services/import.ts` (파싱 로직), `src/views/Import/Import.tsx`

### 2. 이벤트 Properties 및 Custom Properties 목록 UI 표시

이벤트에 연결된 프로퍼티(속성) 목록을 플러그인 UI에서 열람.

- **타입 확장**: `EventMetadata`에 `properties: EventProperty[]` 추가
  ```ts
  interface EventProperty { name: string; type: string; description: string; required: boolean; }
  ```
- **UI**: `AddEvent`/`AllEvents` 탭에 프로퍼티 섹션 추가, 접기/펼치기 가능한 목록
- **Figma 레이블 확장**: `draw.ts`의 `createLabel()`이 properties도 카드에 렌더링
- **NodeMarker 확장**: `PROPERTIES` 마커 추가, `loader.ts` 복원 로직도 함께 수정

### 3. 디자인 요소에 이벤트 매핑

기존에는 이벤트 생성 시 선택한 노드에 1:1로 레이블을 붙였으나,
이미 정의된 이벤트를 다른 노드에도 연결할 수 있도록 확장.

- **UI**: `AllEvents` 탭에서 이벤트 선택 → "Map to Selection" 버튼
- **Main**: `handlers.ts`에 `MAP_EVENT` 메시지 핸들러 추가
  - 선택 노드에 기존 이벤트의 `pluginData` 참조 저장 (또는 레이블 재생성)
- **탐색**: 노드 클릭 시 연결된 이벤트 정보를 UI에 표시하는 역방향 조회

### 4. 새 이벤트 CSV Export (Amplitude Import용)

현재 export는 내부 확인용이지만, Amplitude의 Taxonomy Import 형식에 맞춰 재구성.

- **컬럼 매핑**: Amplitude import CSV 스키마에 맞게 헤더 조정
  - 예: `Event Type`, `Description`, `Category`, `Property Name`, `Property Type` 등
- **Properties 포함**: 위 기능(#2)과 연동하여 프로퍼티 행을 이벤트 아래 펼쳐서 출력
- **파일**: `src/services/csv.ts`의 `exportToCsv()` 확장 또는 `exportAmplitudeCsv()` 신규 추가
- **UI**: `AllEvents` 탭에 "Export for Amplitude" 버튼을 기존 Export 버튼과 구분하여 추가

---

## 개발 명령어

```bash
yarn build   # 프로덕션 빌드
yarn watch   # 개발용 watch 모드
yarn lint    # ESLint (--fix 포함)
```

빌드 결과물은 Figma Desktop → Plugins → Development → Import plugin from manifest로 로드.


---

## 개발 목표 (원본 fork 후 확장)

Amplitude Growth 플랜 기준 — API 직접 등록 없이
**CSV import/export 방식**으로 Amplitude와 연동한다.

### 워크플로우

### 추가할 기능 (우선순위 순)

- [ ] **Phase 1** `lib/parser.ts` 신규 — Amplitude CSV 파싱
- [ ] **Phase 1** `services/import.ts` 신규 — 파일 업로드 처리
- [ ] **Phase 1** `views/ImportEvents/` 신규 — import UI 탭
- [ ] **Phase 1** `entries/importEvents.ts` 신규 — 메뉴 항목 추가
- [ ] **Phase 2** 이벤트 목록에서 선택 → Figma 노드에 매핑
- [ ] **Phase 2** Event properties / custom properties 시각화
- [ ] **Phase 3** export CSV 포맷을 Amplitude import 형식에 맞게 개선

### EventMetadata 확장 계획
```ts
// 현재
{ name, trigger, description, notes }

// 목표
{ name, trigger, description, notes, properties, category, custom }
```