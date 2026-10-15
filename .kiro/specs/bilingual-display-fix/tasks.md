# Implementation Plan

## Task Dependency Graph

```
1 (Bug Condition Test)
│
2 (Preservation Test)
│
└──► 3 (Fix — all four areas)
     ├── 3.1 Restore getI18nField in i18n.js
     ├── 3.2 Fix GANTT_SECTIONS in site-routes.js
     ├── 3.3 Fix SECTIONS + 95 D() calls in process-master.js
     ├── 3.4 Update inline UI strings in site-board.js / project-detail.js
     │        / daily-assign.js / daily-tasks.js / app.js
     ├── 3.5 Verify bug condition exploration test passes (re-run task 1)
     └── 3.6 Verify preservation tests still pass (re-run task 2)
          │
          └──► 4 (Checkpoint — all tests green)
```

**Key constraints:**
- Tasks 1 and 2 run on **UNFIXED** code — results confirm the bug exists and baseline is captured.
- Tasks 3.1–3.4 are independent of each other and can be applied in any order.
- Tasks 3.5 and 3.6 must run **after** 3.1–3.4 (re-run the same tests from 1 and 2).
- Task 4 gates final sign-off.

---

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Chinese-Only Display Output
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists across all four affected areas
  - **Scoped PBT Approach**: For the deterministic cases, scope each sub-test to the known failing concrete inputs for reproducibility
  - Test 1a — `getI18nField` bilingual object path: call `getI18nField({name:{zh:'主体结构',th:'Structural Work'}},'name')` and assert result matches `/[\u4e00-\u9fa5]+ [A-Za-z]/`
    - WILL FAIL: returns `'主体结构'` (th is discarded) instead of `'主体结构 Structural Work'`
  - Test 1b — `GANTT_SECTIONS` Thai check: assert `GANTT_SECTIONS.C.th` matches `/[A-Za-z]/`
    - WILL FAIL: contains `'งานโครงสร้างหลัก'` (Thai Unicode, no ASCII letters)
  - Test 1c — Process library Thai check: assert `LIB.C01.th` matches `/[A-Za-z]/`
    - WILL FAIL: contains `'ผูกเหล็กเสา'` (Thai Unicode, no ASCII letters)
  - Test 1d — Frontend severity label check: assert `sev.high` from `site-board.js` matches `/[A-Za-z]/`
    - WILL FAIL: returns `'高'` (Chinese-only, no English)
  - PBT extension: generate random `{ zh: <ChineseString>, th: <EnglishString> }` objects and assert `getI18nField` returns a string matching `/[\u4e00-\u9fa5]+ [A-Za-z]/`
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — proves the bug exists)
  - Document counterexamples found (e.g. `getI18nField(...)` returns `'主体结构'` not `'主体结构 Structural Work'`)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Bilingual Path Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code first, then encode as tests
  - Observe: `getI18nField({name:{zh:'主体结构'}},'name')` → returns `'主体结构'` (no crash, returns zh when th absent)
  - Observe: `getI18nField(null, 'name')` → returns `''`
  - Observe: `getI18nField({name:'some string'},'name')` → returns `'some string'` as-is
  - Observe: `getUnitText('m²')` → returns `'m²'`; `getUnitText({zh:'m²'})` → returns `'m²'`
  - Observe: `GANTT_SECTIONS.C.color` === `'#3b82f6'`; `GANTT_SECTIONS.C.light` === `'#eff6ff'`
  - Observe: `generatePlan({floors:2,...}).tasks[0].key` format (e.g. `'A01-F1'`); dependency rules unchanged
  - Observe: `t('nav.projects')` → returns `'项目管理 Project Management'` (unchanged)
  - Write property-based tests:
    - PBT: for all `{ zh: <ChineseString> }` objects with no `th`, `getI18nField` never throws and returns the zh value exactly
    - PBT: for all unit string inputs, `getUnitText` returns the input unchanged (no stripping or appending)
    - Unit: `getI18nField(null, 'name')` === `''`
    - Unit: each `GANTT_SECTIONS[k].color` and `.light` unchanged for k in A–I
    - Unit: `generatePlan` task keys and dependency arrays are structurally identical (keys, conditions, units unchanged)
    - Unit: `t('nav.projects')` still returns the existing bilingual string
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix bilingual display across all four areas

  - [ ] 3.1 Restore `getI18nField` in `frontend/js/i18n.js`
    - Replace the current `getI18nField` body with the implementation that returns `${zh} ${th}` when both fields are present
    - Update the function comment to: `// 获取双语字段：返回 "zh th" 合并格式`
    - Remove Thai-stripping logic from `getUnitText`; replace body with: if no unit return `''`; if object return `unit.zh || unit.th || ''`; else return `String(unit)`
    - Ensure `getI18nField` with `{zh}` only still returns zh without crashing (no change to null-guard)
    - _Bug_Condition: isBugCondition(X) where X is a `getI18nField` call on a `{zh, th}` object and result contains no ASCII letters_
    - _Expected_Behavior: result matches `/[\u4e00-\u9fa5]+ [A-Za-z]/` — Chinese text, space, then English word_
    - _Preservation: getI18nField({zh only}) returns zh; getI18nField(null) returns ''; getUnitText('m²') returns 'm²'; t() unchanged_
    - _Requirements: 2.1, 3.1, 3.2, 3.5, 3.6_

  - [ ] 3.2 Fix `GANTT_SECTIONS` `th` fields in `backend/src/site-routes.js`
    - Locate the `GANTT_SECTIONS` constant (around line 536)
    - Replace all nine `th` values with English: A→`Preliminary Works`, B→`Foundation Works`, C→`Structural Work`, D→`Roofing`, E→`MEP Works`, F→`Interior Finishing`, G→`External Facade`, H→`External Works`, I→`Completion & Handover`
    - Do NOT change `color`, `light`, `zh`, section code keys, or any routing/API logic
    - _Bug_Condition: isBugCondition(X) where X is a th field in GANTT_SECTIONS containing Thai Unicode (U+0E00..U+0E7F)_
    - _Expected_Behavior: each GANTT_SECTIONS[k].th matches `/^[A-Za-z]/`_
    - _Preservation: color and light values byte-for-byte identical; Gantt API routing, counts, and task ordering unchanged_
    - _Requirements: 2.2, 3.3_

  - [ ] 3.3 Fix `SECTIONS` map and all 95 process `D()` calls in `backend/src/process-master.js`
    - Replace all nine `SECTIONS` `th` values with English (same mapping as 3.2)
    - Replace the `th` argument in every `D()` call (95 processes across sections A–I) with the English translations specified in the design
    - Do NOT change code keys, zh labels, units, dependency arrays, condition flags, or floor assignment logic
    - _Bug_Condition: isBugCondition(X) where X is a th field in SECTIONS or a D() call containing Thai Unicode_
    - _Expected_Behavior: every LIB[code].th and SECTIONS[k].th matches `/^[A-Za-z]/`_
    - _Preservation: generatePlan task keys, dependency rules, conditions, units, and floor assignments byte-for-byte identical_
    - _Requirements: 2.3, 3.4_

  - [ ] 3.4 Update inline Chinese-only UI strings in frontend JS files
    - **`frontend/js/site-board.js`**: update `st` map and `sev` map — `'正常'`→`'正常 Normal'`, `'等材料'`→`'等材料 Waiting for Materials'`, `'天气停工'`→`'天气停工 Weather Stop'`, `'其他问题'`→`'其他问题 Other Issue'`; `sev.high`→`'高 High'`, `sev.medium`→`'中 Medium'`, `sev.low`→`'低 Low'`; `'技工'`→`'技工 Skilled'`, `'普工'`→`'普工 Helper'`; leave `bi()`-wrapped and already-bilingual strings untouched
    - **`frontend/js/project-detail.js`**: update severity map in override alert — `'高'`→`'高 High'`, `'中'`→`'中 Medium'`, `'低'`→`'低 Low'`
    - **`frontend/js/daily-assign.js`**: update all nine section `th` values to match the standard English names (e.g. `'Main Structure'`→`'Structural Work'`, `'Preparation Work'`→`'Preliminary Works'`)
    - **`frontend/js/daily-tasks.js`**: update status labels — `'正常'`→`'正常 Normal'`, `'等待材料'`→`'等待材料 Waiting for Materials'`, `'天气停工'`→`'天气停工 Weather Stop'`, `'其他问题'`→`'其他问题 Other Issue'`
    - **`frontend/js/app.js`**: `'暂无数据'` fallback at line ~329 already uses `t('common.noData') || '暂无数据'` which is correct — no change needed
    - Only modify user-visible label strings rendered in the DOM; leave `console.warn/log` messages and comments unchanged
    - _Bug_Condition: isBugCondition(X) where X is a frontend string literal containing Chinese characters and no ASCII letters, rendered directly in UI_
    - _Expected_Behavior: every updated string literal matches `/[\u4e00-\u9fa5]+ [A-Za-z]/`_
    - _Preservation: all non-display code paths (event handlers, API calls, data keys, log messages) byte-for-byte identical_
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Chinese-Only Display Output
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior; passing them confirms the fix is correct
    - Run all four sub-tests (1a–1d) and the PBT extension from step 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms bug is fixed across all four areas)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Bilingual Path Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation tests (getI18nField edge cases, getUnitText, GANTT_SECTIONS colors, generatePlan structure, t() function)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions introduced by any of the four changes)
    - Confirm all tests still pass after fix

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite covering exploration tests (task 1) and preservation tests (task 2)
  - Confirm Property 1 (bug condition) passes — all display strings now match `/[\u4e00-\u9fa5]+ [A-Za-z]/`
  - Confirm Property 2 (preservation) passes — all non-display logic is unchanged
  - Spot-check in the browser: Gantt chart section headers, site board status/severity labels, daily assignment section headers, project detail severity alert
  - Ensure all tests pass; ask the user if questions arise
