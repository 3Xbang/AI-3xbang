# Bugfix Requirements Document

## Introduction

The bilingual display system in the construction management app (3XBANG) was incorrectly modified to strip non-Chinese characters and display Chinese-only text, rather than showing the intended "中文 English" dual-language format throughout the UI. This affects:

- `getI18nField` in `frontend/js/i18n.js` — now strips Thai/English from strings instead of appending it
- `GANTT_SECTIONS` in `backend/src/site-routes.js` — still carries Thai (`th`) values instead of English
- `SECTIONS` and all 95 process definitions in `backend/src/process-master.js` — `th` field contains Thai instead of English
- Numerous frontend JS files with hardcoded Chinese-only display strings that bypass the i18n system

The system should display every user-facing label in the format "中文 English" (e.g., "主体结构 Structural Work", "今日现场 Today's Site") so that both Chinese-speaking managers and English-speaking site workers can read the interface.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `getI18nField` processes a bilingual object `{ zh: '主体结构', th: 'English' }` THEN the system returns only the Chinese portion `'主体结构'`, discarding the English label

1.2 WHEN `getI18nField` processes a plain string that previously contained bilingual text (e.g., `"主体结构 • Structural"`) THEN the system strips everything after the separator and returns only `'主体结构'`

1.3 WHEN the Gantt chart is rendered THEN the system sends `GANTT_SECTIONS` section names with Thai values in the `th` field (e.g., `"งานโครงสร้างหลัก"` for Section C) instead of English

1.4 WHEN process definitions are loaded from `process-master.js` THEN the `th` field of all 95 process entries contains Thai text (e.g., `'ผูกเหล็กเสา'`) instead of English translations

1.5 WHEN the `SECTIONS` map in `process-master.js` is read THEN the `th` values are Thai (e.g., `'งานโครงสร้างหลัก'`) rather than English section names

1.6 WHEN frontend JS files render UI labels directly THEN many strings are hardcoded Chinese-only (e.g., `'今日现场'`, `'工序进度'`) without corresponding English text, bypassing the i18n system

### Expected Behavior (Correct)

2.1 WHEN `getI18nField` processes a bilingual object `{ zh: '主体结构', th: 'Structural Work' }` THEN the system SHALL return `'主体结构 Structural Work'` (zh + space + th)

2.2 WHEN `getI18nField` processes a plain string THEN the system SHALL return the string as-is without stripping any characters, since plain strings will already contain properly formatted bilingual text after the other fixes are applied

2.3 WHEN the Gantt chart is rendered THEN the system SHALL send `GANTT_SECTIONS` section names with English values in the `th` field (e.g., `'Structural Work'` for Section C) so the combined display reads `'主体结构 Structural Work'`

2.4 WHEN process definitions are loaded from `process-master.js` THEN the `th` field of all 95 process entries SHALL contain English translations (e.g., `'Column Rebar Binding'` instead of Thai)

2.5 WHEN the `SECTIONS` map in `process-master.js` is read THEN the `th` values SHALL be English section names (e.g., `'Structural Work'` instead of `'งานโครงสร้างหลัก'`)

2.6 WHEN frontend JS files render UI labels THEN all user-visible strings SHALL follow the `'中文 English'` format (e.g., `'今日现场 Today\'s Site'`, `'工序进度 Process Progress'`), either via the i18n system or as correctly formatted inline bilingual literals

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `getI18nField` is called on a field where only `zh` exists and `th` is absent THEN the system SHALL CONTINUE TO return the Chinese text without crashing

3.2 WHEN `getI18nField` is called with a `null` or `undefined` object THEN the system SHALL CONTINUE TO return an empty string

3.3 WHEN the Gantt chart renders colors, progress counts, and task grouping THEN the system SHALL CONTINUE TO display correct section colors, done/in-progress counts, and task ordering — only the section label text changes

3.4 WHEN process plan generation runs (`generatePlan`) THEN the system SHALL CONTINUE TO produce correct task keys, dependency rules, units, conditions, and floor assignments — only the `th` text values change

3.5 WHEN the i18n `t()` function is called with a valid translation key THEN the system SHALL CONTINUE TO return the bilingual string as defined in the `translations` object

3.6 WHEN the `getUnitText` helper is called THEN the system SHALL CONTINUE TO return a unit string (the unit values in `process-master.js` are Chinese characters like `'m²'` and do not need English appended)

---

## Bug Condition Pseudocode

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = a user-facing display string or bilingual data object
  OUTPUT: boolean

  IF X is a bilingual object AND getI18nField(X) returns zh only
    RETURN true
  IF X is a th field value AND contains Thai Unicode (U+0E00..U+0E7F)
    RETURN true
  IF X is a frontend label string AND contains ONLY Chinese characters (no English)
    RETURN true
  RETURN false
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← display(X)
  ASSERT result matches pattern /[\u4e00-\u9fa5]+ [A-Za-z]/   // "中文 English"
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)   // Non-bilingual behavior unchanged
END FOR
```
