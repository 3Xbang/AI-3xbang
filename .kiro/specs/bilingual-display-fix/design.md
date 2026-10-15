# Bilingual Display Fix — Bugfix Design

## Overview

The 3XBANG construction management app was modified to strip non-Chinese text from
display strings, breaking the intended "中文 English" dual-language format throughout
the UI. This fix restores bilingual display across four areas:

1. **`frontend/js/i18n.js` — `getI18nField`**: currently returns only the `zh` portion
   of bilingual objects and strips Thai/English from plain strings. Must be restored to
   return `zh + ' ' + th` so every data-driven label displays both languages.

2. **`backend/src/site-routes.js` — `GANTT_SECTIONS`**: the `th` field of every section
   still holds Thai text (e.g. `"งานโครงสร้างหลัก"`). Must be replaced with English
   so the combined label reads e.g. `"主体结构 Structural Work"`.

3. **`backend/src/process-master.js` — `SECTIONS` + all 95 process `D()` calls**: every
   `th` argument is Thai. Must be replaced with English translations.

4. **Multiple frontend JS files — inline Chinese-only strings**: UI labels hardcoded as
   Chinese-only (status tags, section names, severity labels) must be updated to the
   `'中文 English'` format so they match the rest of the interface.

The fix is intentionally minimal: only the `th` text values change in the backend data;
all logic, keys, units, dependency rules, and conditions are unchanged.

---

## Glossary

- **Bug_Condition (C)**: Inputs that produce a Chinese-only display output — a bilingual
  object whose `th` field is suppressed, a `th` field that still holds Thai text, or a
  frontend string literal containing only Chinese characters.
- **Property (P)**: For any buggy input, the display result SHALL match the pattern
  `/[\u4e00-\u9fa5]+ [A-Za-z]/` — i.e. Chinese followed by a space and English.
- **Preservation**: All non-display logic (task keys, dependency rules, units, DB queries,
  authentication, routing) must remain byte-for-byte identical after the fix.
- **`getI18nField(obj, fieldName)`**: Helper in `frontend/js/i18n.js` that reads a
  bilingual `{ zh, th }` object from a data record and formats it for display.
- **`GANTT_SECTIONS`**: Constant in `backend/src/site-routes.js` mapping section codes
  A–I to display metadata (zh, th, color, light) used by the Gantt chart API endpoint.
- **`SECTIONS`**: Constant in `backend/src/process-master.js` mapping section codes A–I
  to `{ zh, th }` for use in `generatePlan` output.
- **`D(code, zh, th, ...)`**: Factory function in `process-master.js` that registers each
  of the 95 processes into `LIB`. The third argument `th` is the English label to fix.

---

## Bug Details

### Bug Condition

The bug manifests in three distinct contexts:

**Context 1 — `getI18nField` object path**: when the function receives a bilingual object
like `{ zh: '主体结构', th: 'Structural Work' }`, it returns only `'主体结构'` because
the `th` field is intentionally discarded.

**Context 2 — Backend `th` fields contain Thai**: when `GANTT_SECTIONS` or any process
`D()` call sends data to the frontend, the `th` field holds Thai Unicode text rather than
English, so even if `getI18nField` were fixed, the combined result would show Thai.

**Context 3 — Inline frontend strings**: UI labels in multiple JS files are hardcoded
Chinese-only, bypassing the i18n system entirely.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X = a user-facing display value or data source
  OUTPUT: boolean

  IF X is a call to getI18nField(obj, field)
     AND obj[field] is a {zh, th} object
     AND result contains NO ASCII letters
    RETURN true

  IF X is a th field value in GANTT_SECTIONS or process-master.js
     AND X contains Thai Unicode (U+0E00..U+0E7F)
    RETURN true

  IF X is a frontend string literal
     AND X contains Chinese characters (U+4E00..U+9FFF)
     AND X contains NO ASCII letters (a-z A-Z)
     AND X is rendered directly in the UI (not a log, comment, or key)
    RETURN true

  RETURN false
END FUNCTION
```

### Examples

| Location | Current (defect) | Expected (correct) |
|---|---|---|
| `getI18nField({name:{zh:'主体结构',th:'Structural Work'}}, 'name')` | `'主体结构'` | `'主体结构 Structural Work'` |
| `GANTT_SECTIONS.C.th` | `'งานโครงสร้างหลัก'` | `'Structural Work'` |
| `LIB.C01.th` (柱钢筋绑扎) | `'ผูกเหล็กเสา'` | `'Column Rebar Binding'` |
| `project-detail.js` severity alert | `'高'` | `'高 High'` |
| `site-board.js` status label | `'等材料'` | `'等材料 Waiting for Materials'` |
| `daily-assign.js` section header | `'主体结构'` | `'主体结构 Structural Work'` |

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `getI18nField` called on an object where only `zh` exists and `th` is absent SHALL
  continue to return the Chinese text without crashing (Requirement 3.1)
- `getI18nField` called with `null` or `undefined` SHALL continue to return `''` (Req 3.2)
- `getUnitText` SHALL continue to return Chinese/mixed unit strings (e.g. `'m²'`) as-is
  without appending English — unit values do not need English equivalents (Req 3.6)
- Gantt chart colors (`color`, `light`), done/in-progress counts, and task ordering SHALL
  remain unchanged — only the section label `th` text changes (Req 3.3)
- `generatePlan` SHALL continue to produce identical task keys, dependency rules, units,
  conditions, and floor assignments — only the `th` text values in output tasks change (Req 3.4)
- The `t()` function in `i18n.js` SHALL continue to return bilingual strings from the
  `translations` object exactly as before (Req 3.5)

**Scope of non-bilingual inputs:**
All existing logic paths that do not produce a user-visible display string are unaffected,
including: API routing, authentication middleware, database queries, plan generation
algorithms, and condition evaluation.

---

## Hypothesized Root Cause

1. **Intentional stripping in `getI18nField`**: The function comment explicitly states
   _"只返回中文（th字段是数据库中的泰语，不显示）"_. The object path discards `th`;
   the string path uses `.replace()` to strip Thai Unicode. This was a deliberate but
   incorrect change — `th` was renamed from Thai to English at the DB/data layer, but
   the display function was not updated to match.

2. **`th` fields never updated in `process-master.js` and `GANTT_SECTIONS`**: When the
   project switched from Thai to English for the `th` field, only new or recently-edited
   entries were updated. The bulk of the 95 process definitions and the 9 Gantt sections
   still carry the original Thai values.

3. **`getUnitText` over-strips**: The function also strips Thai Unicode from unit strings.
   Since unit values like `'m²'` or `'项'` contain no Thai, this is currently harmless —
   but the strip logic should be removed to avoid silently corrupting any future unit
   that happens to contain English.

4. **Frontend inline strings were never updated**: Several JS files were written when the
   app was Chinese-only. As the bilingual standard was adopted, the `translations` object
   in `i18n.js` was updated, but the inline literals scattered across other files were not.

---

## Correctness Properties

Property 1: Bug Condition — Bilingual Object Display

_For any_ bilingual object `{ zh, th }` passed through `getI18nField`, and _for any_
`th` field value in `GANTT_SECTIONS` or `process-master.js`, and _for any_ inline UI
string literal in the frontend, the fixed system SHALL produce a display string that
matches the pattern `/<Chinese>+ <EnglishWord>/` — i.e. Chinese text, a space, then at
least one ASCII word — so that both Chinese-speaking managers and English-speaking site
workers can read every label.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — Non-Bilingual Path Unchanged

_For any_ input where the bug condition does NOT hold — including `getI18nField` calls
on objects with no `th` field, calls with `null`/`undefined`, `getUnitText` calls on
unit strings, all Gantt chart rendering logic (colors, counts, task ordering), all
`generatePlan` outputs (keys, dependencies, conditions), and the `t()` function — the
fixed system SHALL produce exactly the same result as the original, preserving all
non-display behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Change 1 — `frontend/js/i18n.js`: Restore `getI18nField`

**File:** `frontend/js/i18n.js`  
**Function:** `getI18nField(obj, fieldName)`

Replace the current implementation with:

```javascript
function getI18nField(obj, fieldName) {
    if (!obj) return '';

    const field = obj[fieldName];

    // Bilingual object: return "zh th" combined
    if (field && typeof field === 'object') {
        const zh = field.zh || '';
        const th = field.th || '';
        if (zh && th) return `${zh} ${th}`;
        return zh || th || '';
    }

    // Plain string: return as-is (will already be bilingual after other fixes)
    if (typeof field === 'string') return field;

    return field || '';
}
```

Also update `getUnitText` to remove the Thai-stripping logic (since units like `'m²'`,
`'项'`, `'根'` contain no Thai and the strip is now incorrect intent):

```javascript
function getUnitText(unit) {
    if (!unit) return '';
    if (typeof unit === 'object') return unit.zh || unit.th || '';
    return String(unit);
}
```

The function comment must be updated to: `// 获取双语字段：返回 "zh th" 合并格式`

---

### Change 2 — `backend/src/site-routes.js`: Fix `GANTT_SECTIONS` English `th` fields

**File:** `backend/src/site-routes.js`  
**Location:** `GANTT_SECTIONS` constant (line ~536)

Replace the `th` value of each section with English:

| Code | zh | th (current Thai → new English) |
|------|----|----------------------------------|
| A | 前期准备 | `Preliminary Works` |
| B | 地基基础 | `Foundation Works` |
| C | 主体结构 | `Structural Work` |
| D | 屋面工程 | `Roofing` |
| E | 机电工程 | `MEP Works` |
| F | 内装修   | `Interior Finishing` |
| G | 外立面   | `External Facade` |
| H | 室外工程 | `External Works` |
| I | 竣工验收 | `Completion & Handover` |

The `color` and `light` values are NOT changed.

---

### Change 3 — `backend/src/process-master.js`: Fix `SECTIONS` + all 95 process `th` fields

**File:** `backend/src/process-master.js`

#### 3a — `SECTIONS` map

| Code | zh | th (current → new) |
|------|----|---------------------|
| A | 前期准备   | `Preliminary Works` |
| B | 地基与基础 | `Foundation Works` |
| C | 主体结构   | `Structural Work` |
| D | 屋面       | `Roofing` |
| E | 机电       | `MEP Works` |
| F | 装饰装修   | `Interior Finishing` |
| G | 外立面     | `External Facade` |
| H | 室外工程   | `External Works` |
| I | 验收与交付 | `Completion & Handover` |

#### 3b — 95 process `D()` calls: English `th` translations

**Section A — Preliminary Works (3 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| A01 | 施工放线与定位 | `Site Layout & Setting Out` |
| A02 | 临时设施（围挡、工棚、临水临电）| `Temporary Facilities` |
| A03 | 场地清理与平整 | `Site Clearing & Grading` |

**Section B — Foundation Works (11 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| B01 | 基坑开挖 | `Foundation Excavation` |
| B02 | 桩基施工与检测 | `Pile Foundation & Testing` |
| B03 | 地基处理（换填夯实）| `Ground Treatment & Compaction` |
| B04 | 混凝土垫层 | `Concrete Blinding` |
| B05 | 基础防水 | `Foundation Waterproofing` |
| B06 | 基础钢筋绑扎 | `Foundation Rebar Binding` |
| B07 | 基础模板 | `Foundation Formwork` |
| B08 | 基础混凝土浇筑 | `Foundation Concrete Pour` |
| B09 | 基础养护与拆模 | `Foundation Curing & Formwork Removal` |
| B10 | 基坑回填 | `Foundation Backfill` |
| B11 | 地下室结构 | `Basement Structure` |

**Section C — Structural Work (13 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| C12 | 脚手架搭设与拆除 | `Scaffolding Erection & Removal` |
| C01 | 柱钢筋绑扎 | `Column Rebar Binding` |
| C02 | 柱模板安装 | `Column Formwork` |
| C03 | 柱混凝土浇筑 | `Column Concrete Pour` |
| C04 | 梁板模板安装 | `Beam & Slab Formwork` |
| C05 | 梁板钢筋绑扎 | `Beam & Slab Rebar Binding` |
| C06 | 梁板混凝土浇筑 | `Beam & Slab Concrete Pour` |
| C07 | 梁板养护与拆模 | `Beam & Slab Curing & Formwork Removal` |
| C08 | 楼梯施工 | `Staircase Construction` |
| C09 | 砖墙/砌块砌筑 | `Brick/Block Masonry` |
| C10 | 构造柱施工 | `Tie Column Construction` |
| C11 | 圈梁与过梁 | `Ring Beam & Lintel` |
| C13 | 阳台、雨棚、挑檐 | `Balcony, Canopy & Overhangs` |

**Section D — Roofing (8 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| D01 | 屋面结构层（平屋面）| `Flat Roof Structural Layer` |
| D02 | 屋架安装（坡屋面，钢/木）| `Pitched Roof Frame Installation` |
| D03 | 屋面找坡找平 | `Roof Slope & Screed` |
| D04 | 屋面保温隔热 | `Roof Insulation` |
| D05 | 屋面防水 | `Roof Waterproofing` |
| D06 | 屋面面层（瓦/地砖/涂料）| `Roof Finish Layer` |
| D07 | 屋面排水（天沟、落水管）| `Roof Drainage` |
| D08 | 屋面蓄水或淋水试验 | `Roof Water Test` |

**Section E — MEP Works (14 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| E01 | 梁板内水电预埋 | `MEP Conduit in Slab` |
| E14 | 墙体开槽布管预埋（线管、86盒）| `Wall Conduit & Box Roughing-in` |
| E02 | 空调管线预埋 | `AC Conduit Roughing-in` |
| E03 | 给水管道安装 | `Water Supply Pipe Installation` |
| E04 | 排水管道安装 | `Drainage Pipe Installation` |
| E05 | 强电线路敷设与穿线 | `Power Wiring` |
| E06 | 弱电线路敷设 | `Low-Voltage Wiring` |
| E07 | 配电箱及总配电安装 | `Distribution Board Installation` |
| E08 | 水电隐蔽验收 | `MEP Concealed Works Inspection` |
| E09 | 防雷与接地 | `Lightning Protection & Earthing` |
| E10 | 水泵、水箱安装 | `Pump & Water Tank Installation` |
| E11 | 热水系统安装 | `Hot Water System Installation` |
| E12 | 空调设备安装 | `Air Conditioning Installation` |
| E13 | 电梯安装 | `Elevator Installation` |

**Section F — Interior Finishing (31 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| F01 | 墙面基层处理 | `Wall Surface Preparation` |
| F02 | 内墙抹灰 | `Internal Wall Plastering` |
| F03 | 天花抹灰 | `Ceiling Plastering` |
| F04 | 卫生间、厨房、阳台防水 | `Wet Area Waterproofing` |
| F05 | 闭水试验 | `Water Ponding Test` |
| F06 | 地面找平层 | `Floor Screed` |
| F07 | 墙砖铺贴 | `Wall Tile Laying` |
| F08 | 地砖铺贴 | `Floor Tile Laying` |
| F09 | 石材地面 | `Stone Flooring` |
| F10 | 吊顶龙骨 | `Ceiling Frame` |
| F11 | 石膏板吊顶 | `Gypsum Board Ceiling` |
| F12 | 铝扣板吊顶（厨卫）| `Aluminum Ceiling (Wet Areas)` |
| F13 | 墙面找平 | `Wall Leveling` |
| F14 | 腻子批刮 | `Putty Application` |
| F15 | 乳胶漆涂刷 | `Emulsion Paint` |
| F16 | 墙纸粘贴 | `Wallpaper Installation` |
| F17 | 木地板安装 | `Timber Flooring` |
| F18 | 门窗框安装 | `Door & Window Frame Installation` |
| F19 | 门扇安装 | `Door Leaf Installation` |
| F20 | 窗扇安装 | `Window Sash Installation` |
| F21 | 玻璃安装 | `Glass Installation` |
| F22 | 入户门与防盗门安装 | `Main Entrance & Security Door` |
| F23 | 踢脚线 | `Skirting Board` |
| F24 | 楼梯栏杆与扶手 | `Stair Balustrade & Handrail` |
| F25 | 固定家具/衣柜 | `Built-in Furniture/Wardrobe` |
| F26 | 卫生洁具安装 | `Sanitary Fixture Installation` |
| F27 | 淋浴房安装 | `Shower Enclosure Installation` |
| F28 | 橱柜安装 | `Kitchen Cabinet Installation` |
| F29 | 台面安装 | `Countertop Installation` |
| F30 | 灯具安装 | `Light Fixture Installation` |
| F31 | 开关插座安装 | `Switch & Socket Installation` |

**Section G — External Facade (5 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| G05 | 外墙吊篮或外脚手 | `External Scaffolding` |
| G01 | 外墙抹灰 | `External Wall Plastering` |
| G02 | 外墙保温 | `External Wall Insulation` |
| G03 | 外墙面层（涂料/外墙砖/石材）| `External Wall Finish` |
| G04 | 外门窗收口与打胶 | `External Window Sealing` |

**Section H — External Works (6 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| H01 | 化粪池与污水处理 | `Septic Tank & Sewage Treatment` |
| H02 | 室外给排水管网 | `External Water & Drainage Network` |
| H03 | 围墙与大门 | `Perimeter Wall & Gate` |
| H04 | 道路与铺装 | `Road & Paving` |
| H05 | 庭院景观与绿化 | `Landscaping & Greenery` |
| H06 | 泳池 | `Swimming Pool` |

**Section I — Completion & Handover (4 processes)**

| Code | zh | th (new English) |
|------|----|------------------|
| I01 | 分层竣工检查与整改清单 | `Floor-by-Floor Completion Inspection` |
| I02 | 竣工清洁 | `Final Cleaning` |
| I03 | 竣工验收与移交 | `Final Acceptance & Handover` |
| I04 | 整改与保修登记 | `Rectification & Warranty Registration` |

**Total: 3 + 11 + 13 + 8 + 14 + 31 + 5 + 6 + 4 = 95 processes ✓**

---

### Change 4 — Frontend JS files: inline Chinese-only UI strings

Only user-visible label strings (rendered in the DOM) need to be updated. Error messages
sent to `console.warn/log` and comment strings are out of scope. Apply the `'中文 English'`
pattern to the following:

#### `frontend/js/site-board.js`

| Current | Replace with |
|---------|--------------|
| `'正常'` (status label in `st` map) | `'正常 Normal'` |
| `'等材料'` (status label) | `'等材料 Waiting for Materials'` |
| `'天气停工'` (status label) | `'天气停工 Weather Stop'` |
| `'其他问题'` (status label) | `'其他问题 Other Issue'` |
| `{ high: '高', medium: '中', low: '低' }` (severity `sev` map) | `{ high: '高 High', medium: '中 Medium', low: '低 Low' }` |
| `'正在做'` (in section headers) | already wrapped in `bi('正在做','In Progress')` — no change needed |
| `'还没开始'` (in section headers) | already wrapped in `bi('还没开始','Not Started')` — no change needed |
| `'技工'` (crew label, standalone) | `'技工 Skilled'` |
| `'普工'` (crew label, standalone) | `'普工 Helper'` |
| `'已保存'` (toast in quota save) | `'已保存 Saved'` |

#### `frontend/js/project-detail.js`

| Current | Replace with |
|---------|--------------|
| `{ high: '高', medium: '中', low: '低' }` in override alert | `{ high: '高 High', medium: '中 Medium', low: '低 Low' }` |

Note: The tab list objects (`{ zh: '项目准备', th: 'Project Prep', ... }`) already use
the `zh`/`th` structure and are rendered via `getI18nField` — they will display correctly
once Change 1 is applied.

#### `frontend/js/daily-assign.js`

Section headers in the task picker are hardcoded Chinese-only. These map directly to the
`SECTIONS` data and should either pull from the API response or be updated to the bilingual
format inline:

| Current | Replace with |
|---------|--------------|
| `'前期准备'` | `'前期准备 Preliminary Works'` |
| `'地基与基础'` | `'地基与基础 Foundation Works'` |
| `'主体结构'` | `'主体结构 Structural Work'` |
| `'屋面'` | `'屋面 Roofing'` |
| `'机电'` | `'机电 MEP Works'` |
| `'装饰装修'` | `'装饰装修 Interior Finishing'` |
| `'外立面'` | `'外立面 External Facade'` |
| `'室外工程'` | `'室外工程 External Works'` |
| `'验收与交付'` | `'验收与交付 Completion & Handover'` |

Sub-type labels in the task picker also need English added (structural, MEP, finishing
category names displayed as section groupings in the "Add Task" modal).

#### `frontend/js/daily-tasks.js`

Status labels rendered in the UI:

| Current | Replace with |
|---------|--------------|
| `'正常'` | `'正常 Normal'` |
| `'等待材料'` | `'等待材料 Waiting for Materials'` |
| `'天气停工'` | `'天气停工 Weather Stop'` |
| `'其他问题'` | `'其他问题 Other Issue'` |

#### `frontend/js/app.js`

| Current | Replace with |
|---------|--------------|
| `'暂无数据'` fallback (line ~329) | use `t('common.noData')` which is already `'暂无数据 No Data'` |

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first surface counterexamples that
demonstrate the bug on unfixed code to confirm root cause analysis, then verify the fix
works and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate the bug BEFORE implementing the fix. Confirm or refute root cause.

**Test Plan**: Call `getI18nField` with known bilingual objects and assert the returned
string contains English. Inspect `GANTT_SECTIONS` and `LIB` for Thai Unicode. Render
UI strings and check for Chinese-only output.

**Test Cases:**
1. **`getI18nField` bilingual object test**: Call `getI18nField({name:{zh:'主体结构',th:'Structural Work'}},'name')` — WILL FAIL on unfixed code (returns `'主体结构'`, missing English)
2. **`GANTT_SECTIONS` Thai check**: Assert `GANTT_SECTIONS.C.th` matches `/[A-Za-z]/` — WILL FAIL (contains `'งานโครงสร้างหลัก'`)
3. **Process library Thai check**: Assert `LIB.C01.th` matches `/[A-Za-z]/` — WILL FAIL (contains `'ผูกเหล็กเสา'`)
4. **Frontend label check**: Assert `site-board.js` severity map `sev.high` matches `/[A-Za-z]/` — WILL FAIL (returns `'高'` only)

**Expected Counterexamples:**
- `getI18nField` returns Chinese-only strings even when `th` contains valid English
- Thai Unicode found in all 9 `GANTT_SECTIONS` `th` values
- Thai Unicode found in all 95 process `th` values
- Chinese-only label strings rendered directly in DOM without English equivalents

### Fix Checking

**Goal**: Verify that for all bug-condition inputs, the fixed system produces bilingual output.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := displayFixed(X)
  ASSERT result MATCHES /[\u4e00-\u9fa5]+ [A-Za-z]/
END FOR
```

**Specific assertions after fix:**
- `getI18nField({name:{zh:'主体结构',th:'Structural Work'}},'name')` === `'主体结构 Structural Work'`
- `getI18nField({name:{zh:'柱钢筋绑扎',th:'Column Rebar Binding'}},'name')` === `'柱钢筋绑扎 Column Rebar Binding'`
- `GANTT_SECTIONS[k].th` for all k in `['A'..'I']` — no Thai Unicode
- `LIB[code].th` for all 95 codes — no Thai Unicode, every value matches `/[A-Za-z]/`
- All updated frontend string literals match `/[\u4e00-\u9fa5]+ [A-Za-z]/`

### Preservation Checking

**Goal**: Verify that for all non-bug inputs, behavior is unchanged.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT originalSystem(X) = fixedSystem(X)
END FOR
```

**Key preservation assertions:**
- `getI18nField({name:{zh:'主体结构'}},'name')` === `'主体结构'` (no `th` field → no crash, returns zh)
- `getI18nField(null, 'name')` === `''`
- `getUnitText('m²')` === `'m²'`; `getUnitText({zh:'m²'})` === `'m²'`
- `GANTT_SECTIONS.C.color` === `'#3b82f6'` (unchanged)
- `GANTT_SECTIONS.C.light` === `'#eff6ff'` (unchanged)
- `generatePlan({floors:2,...}).tasks[0].key` format unchanged
- `generatePlan({floors:2,...}).deps` — all dependency rules identical
- `t('nav.projects')` === `'项目管理 Project Management'` (unchanged)

### Unit Tests

- Test `getI18nField` with `{zh, th}` object → returns `'zh th'`
- Test `getI18nField` with `{zh}` only → returns `'zh'` (no crash)
- Test `getI18nField` with `null` → returns `''`
- Test `getI18nField` with plain string → returns string as-is
- Test `getUnitText` with `'m²'`, `{zh:'m²'}`, `null` → correct values
- Test each of the 9 `GANTT_SECTIONS` entries: `th` field matches `/^[A-Za-z]/`
- Test all 95 `LIB` entries: `th` field matches `/^[A-Za-z]/`
- Test `SECTIONS` map: all 9 `th` values match `/^[A-Za-z]/`
- Spot-check updated frontend strings in key files: `sev.high`, `sev.medium`, `sev.low`

### Property-Based Tests

- Generate random `{ zh: <ChineseString>, th: <EnglishString> }` objects and assert
  `getI18nField` always returns `zh + ' ' + th`
- Generate random `{ zh: <ChineseString> }` objects (no `th`) and assert `getI18nField`
  never throws and returns the `zh` value
- For all entries in `LIB`, assert the `th` field contains no Thai Unicode characters
  (U+0E00..U+0E7F) — this can be run as a data-integrity check after the fix

### Integration Tests

- Render the Gantt chart for a test project and assert each section header in the JSON
  response contains both Chinese and English text
- Load the site board and assert all status labels display bilingual text
- Trigger the plan generation for a 2-floor project and assert all task `th` values in
  the returned plan are English
- Open the daily assignment panel and assert all section group headers are bilingual
