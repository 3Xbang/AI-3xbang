# Design Review - Construction Management System v2

**Review Date**: 2024-01-15  
**Design Version**: 2.1  
**Reviewer**: Design Review Agent  
**Backend Path**: `e:\3XBANG\.worktrees\construction-v2\backend\src`

---

## Executive Summary

**VERDICT**: **CHANGES_REQUESTED**

**HIGH Findings**: 3  
**MEDIUM Findings**: 5  
**NIT Findings**: 4  

The design contains significant ambiguities in API specifications, unverified assumptions about existing backend services, and missing concrete specifications for critical calculation formulas. While the overall architecture is sound and the database schema is well-documented, implementation cannot proceed until these gaps are addressed.

---

## Findings

### HIGH-1: Missing Service Files - Unverified Architecture Assumption

**Location**: Design section 1.2 "Technology Stack Reuse", section 4 "Backend API Design"

**Problem**: The design claims to reuse existing backend architecture and references three service files that **do not exist**:
- `backend/src/services/process.service.js` (referenced, does not exist)
- `backend/src/services/worker.service.js` (referenced, does not exist)
- `backend/src/services/report.service.js` (referenced, does not exist)

**Verification**: Actual existing services in `e:\3XBANG\.worktrees\construction-v2\backend\src\services`:
- `auth.service.js` ✓
- `issue.service.js` ✓
- `material.service.js` ✓
- `node.service.js` ✓

The design's claim that "existing helpers handle this" is false. The design assumes `process.service.js` with methods like `checkin()`, `calculateWorkers()`, `calculateMaterials()`, and `validateBaseData()` but this file must be **created from scratch**, not extended.

**Fix**: 
1. Update section 1.2 to state: "New service files required: `process.service.js`, `worker.service.js`, `report.service.js`"
2. In section 4.2, change "使用现有架构" to "创建新服务层"
3. Add explicit statement: "These services will be created following the patterns in existing `node.service.js` and `material.service.js`"
4. Specify whether `node.service.js` should be refactored/renamed to `process.service.js` or kept as-is with new service files added

---

### HIGH-2: Ambiguous API Error Handling Strategy

**Location**: Section 4 "Backend API Design", section 4.2 sample responses

**Problem**: The design shows example error responses but does not specify:
1. When to return 400 vs 422 vs 500 status codes
2. Whether validation errors return single message or array of field errors
3. How calculation formula errors (e.g., division by zero, missing prev node) are surfaced
4. Whether photo upload failures abort the entire checkin or return partial success

Example ambiguity in section 4.2:
```javascript
// What happens if 2 of 3 photos fail to upload?
// What if calculation succeeds but database insert fails?
// Does the transaction roll back? Are photos deleted?
```

**Fix**: Add section "4.3 Error Handling Rules":
```markdown
## 4.3 Error Handling Rules

1. **Status Codes**:
   - 400: Client input validation failure (missing required fields, photo count < 3)
   - 422: Business rule violation (previous node not approved, area out of range)
   - 500: Server error (database failure, file system error)

2. **Validation Errors Format**:
   ```json
   {
     "success": false,
     "code": 400,
     "message": "验证失败",
     "errors": [
       {"field": "photos", "message": "至少上传3张照片"},
       {"field": "base_data.length", "message": "长度必须在0.1-1000之间"}
     ]
   }
   ```

3. **Transaction Semantics**:
   - Photo upload uses multipart transaction: if ANY photo fails, ALL are discarded
   - Database insert is atomic: if record insert fails, uploaded photos are deleted via cleanup handler
   - Calculation errors (e.g., prev node not approved) return 422 BEFORE photo upload

4. **Calculation Formula Errors**:
   - Missing base_data fields: 422 with specific field name
   - Division by zero (estimated_days = 0): default to 1 day, log warning
   - Material library lookup failure: continue with null unit_price, flag in response
```

---

### HIGH-3: Incomplete Base Data Schema Validation Specification

**Location**: Design section 3 "Calculation Logic Implementation", section 4.2 "Basic Data Validation"

**Problem**: The design shows validation functions for `area`, `dimension`, and `quantity`, but does not specify:
1. Which validation rules apply to which of the 31 processes (each process has different `base_data_schema`)
2. How the `base_data_schema` JSON in `process_nodes` table drives validation (is it a JSON Schema, custom format, or hardcoded per-process?)
3. Whether validation errors on optional fields (e.g., `depth` when only `area` is provided) should block submission
4. How derived fields (area = length × width, volume = length × width × depth) are handled if user provides conflicting values

Example ambiguity:
```javascript
// Process P001 requires length, width, depth
// User sends: {length: 50, width: 30, depth: 2, volume: 2500}
// Calculated volume = 50 × 30 × 2 = 3000 ≠ 2500
// Should this reject (422), override user's volume, or trust user's input?
```

**Fix**: Add section "3.4 Base Data Validation Rules":
```markdown
## 3.4 Base Data Validation Rules

1. **Schema-Driven Validation**:
   The `base_data_schema` in `process_nodes.base_data_schema` is a JSON object:
   ```json
   {
     "length": {
       "type": "number",
       "unit": "m",
       "label_i18n": {"zh": "长度", "th": "ความยาว", "en": "Length"},
       "required": true,
       "min": 0.1,
       "max": 1000
     }
   }
   ```
   Validation applies `required`, `min`, `max` per field.

2. **Derived Field Handling**:
   - User MAY provide `area` and/or `volume`
   - If NOT provided, backend calculates: `area = length × width`, `volume = length × width × depth`
   - If provided, backend OVERWRITES with calculated value (user input is ignored for derived fields)
   - Stored `base_data` always contains calculated values

3. **Validation Error Response**:
   ```json
   {
     "success": false,
     "code": 422,
     "message": "基础数据验证失败",
     "errors": [
       {"field": "base_data.length", "message": "长度必须在0.1-1000之间"}
     ]
   }
   ```

4. **Per-Process Schema**:
   - See `design-data-31-processes.json` for each process's `base_data_schema`
   - Schema is stored in database and fetched at runtime (not hardcoded in service)
```

---

### MEDIUM-1: Ambiguous Trilingual Fallback Strategy

**Location**: Section 5.4 "I18n Implementation", FR-6 "Multilingual Support"

**Problem**: The design states:
```javascript
t(key) {
  return this.translations[key] || this.fallback[key] || key;
}
```

But does not specify:
1. If a material's `name_i18n` has `zh` and `th` but missing `en`, should it fall back to `zh`, show `key`, or block data import?
2. If the i18n JSON file (`/i18n/th.json`) fails to load, does the app continue with Chinese-only UI or block login?
3. Are database JSONB `name_i18n` fields validated at INSERT time (constraints exist) or only at SELECT time?

**Fix**: Add to section 5.4:
```markdown
### 5.4.1 Trilingual Fallback Rules

1. **Database Constraints**: 
   - All `*_i18n` JSONB columns have CHECK constraints requiring all 3 languages (zh, th, en)
   - INSERT/UPDATE fails with 422 if any language is missing or empty string
   - Data import scripts MUST provide complete translations

2. **Frontend Translation Fallback**:
   - If i18n file fails to load: use hardcoded `fallback` object (Chinese), show warning banner
   - If a key is missing from loaded file: fall back to `fallback` object, log console.warn
   - If a key is missing from fallback: return the key itself (e.g., "app.unknown_key")

3. **Runtime Language Switching**:
   - Language change re-fetches `/i18n/{lang}.json`
   - If fetch fails: stay on current language, show error toast
   - updateDOM() only runs after successful JSON load
```

---

### MEDIUM-2: Cost Calculation Dependencies Not Sequenced

**Location**: Section 3.3 "Cost Calculation", design-calculations.md

**Problem**: The cost calculation function queries multiple tables:
```javascript
// Pseudocode from design
plannedMaterialCost = SUM(calculated_materials × material_library.unit_price)
actualLaborCost = SUM(daily_attendance.days × workers.daily_wage)
```

But does not specify:
1. What happens if `material_library` lookup returns NULL (material code not found)?
2. What happens if `workers` table has 0 rows for a project (avgWage calculation)?
3. Whether the default wage of 500 THB is per-project or system-wide
4. How currency conversion is handled if a project uses USD or CNY (design says "THB" but doesn't enforce it)

**Fix**: Add to section 3.3:
```markdown
### 3.3.1 Cost Calculation Edge Cases

1. **Missing Material Price**:
   - If `material_library.unit_price` is NULL or material_code not found: treat as 0, include in variance note
   - Response includes `missing_prices: ["M001", "M005"]` array

2. **No Workers Registered**:
   - If `SELECT AVG(daily_wage) FROM workers` returns NULL: use 500 THB (Thailand minimum wage baseline)
   - Log warning: "Project {id} has no workers, using default wage"

3. **Currency**:
   - All costs are in THB (Thai Baht)
   - `projects.currency` field is read-only, defaults to 'THB', no conversion logic
   - If future currency support needed, must be separate feature (out of scope)

4. **Variance Calculation**:
   - If `planned = 0`, variance_percentage = NULL (not infinity or error)
   - If `actual > planned` by >10%: set `needsAttention: true` flag
```

---

### MEDIUM-3: Photo Watermarking GPS Timeout Unclear

**Location**: Section 5.5 "Watermark Implementation"

**Problem**: The watermark function includes:
```javascript
const gps = await this.getCurrentGPS(10000); // 10s timeout
if (gps) {
  ctx.fillText(`GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`, ...);
}
```

But does not specify:
1. If GPS times out, does the photo upload proceed WITHOUT GPS (allowing fake location)?
2. Is GPS optional or required for approval? (affects fraud prevention)
3. Does enableHighAccuracy=false mean GPS can be off by 100m+? (design says "不启用高精度")

**Fix**: Add to section 5.5:
```markdown
### 5.5.1 GPS Handling Rules

1. **GPS Timeout**:
   - Timeout: 10 seconds (balances UX vs. accuracy)
   - If timeout or permission denied: watermark shows "GPS: 不可用" (unavailable)
   - Photo upload PROCEEDS (GPS is optional)

2. **GPS Accuracy**:
   - `enableHighAccuracy: false` uses network/cell tower location (~50-500m accuracy)
   - High accuracy disabled to avoid 30s+ wait times and battery drain
   - Boss can see GPS availability in photo metadata and request re-submission if suspicious

3. **GPS Storage**:
   - Stored in `node_records.watermark_info` JSONB: `{"gps": {"lat": 9.5353, "lng": 100.0633}, "timestamp": "2024-01-15T10:30:00Z"}`
   - NULL if unavailable
   - Frontend shows map pin icon if GPS present, gray icon if absent
```

---

### MEDIUM-4: Material Variance Trigger Logic Incomplete

**Location**: Design-database.md section 4.1 "Material Variance Trigger"

**Problem**: The trigger calculates variance:
```sql
NEW.variance_percentage := ROUND(
  ((NEW.quantity - NEW.planned_quantity) / NEW.planned_quantity * 100)::NUMERIC, 
  2
);
```

But does not specify:
1. Where does `planned_quantity` come from? (not in material_records schema in design-database.md)
2. Is this field added to material_records or calculated from node_records.calculated_materials?
3. If planned_quantity is NULL, should variance be NULL or trigger an error?

**Fix**: Add to design-database.md section 2.3:
```markdown
### 2.3.1 Material Records Planned Quantity

**Add field**:
```sql
ALTER TABLE material_records
  ADD COLUMN IF NOT EXISTS planned_quantity DECIMAL(10, 2);

COMMENT ON COLUMN material_records.planned_quantity IS '计划用量（从工序打卡记录的calculated_materials复制）';
```

**Population Logic**:
When worker checks in process and boss approves, backend COPIES `calculated_materials.{materialCode}.quantity` 
to `material_records.planned_quantity` for comparison.

**Variance Trigger Update**:
```sql
IF NEW.planned_quantity IS NOT NULL AND NEW.planned_quantity > 0 THEN
  NEW.variance_percentage := ROUND(...);
ELSE
  NEW.variance_percentage := NULL;  -- Cannot calculate without plan
END IF;
```
```

---

### MEDIUM-5: Integration Test Coverage Gaps

**Location**: Section 6.2 "Integration Tests"

**Problem**: The design shows ONE integration test (checkin with 3 photos) but acceptance criteria AC-5 requires:
- "Create project → 31 processes → clock-in → approve → report"

The design does not specify:
1. Test for sequential process unlocking (P002 locked until P001 approved)
2. Test for material library lookup during calculation
3. Test for cost report with 0 attendance records
4. Test for i18n parameter (?lang=th) on process list endpoint

**Fix**: Add to section 6.2:
```javascript
### 6.2.1 End-to-End Test Suite

describe('E2E: Full Project Lifecycle', () => {
  it('Creates project and completes all 31 processes', async () => {
    // 1. Create project
    const project = await createProject({name: 'Test Building', location: 'Bangkok'});
    
    // 2. Verify 31 processes loaded, all locked except P001
    const processes = await getProcesses(project.id);
    expect(processes.length).to.equal(31);
    expect(processes.filter(p => p.status === 'locked').length).to.equal(30);
    
    // 3. Check in P001 with 3 photos
    const checkin1 = await checkinProcess(1, {photos: [f1, f2, f3], base_data: {length: 50, width: 30, depth: 2}});
    expect(checkin1.calculated_workers.count).to.be.greaterThan(0);
    
    // 4. Boss approves P001
    await approveRecord(checkin1.record_id);
    
    // 5. Verify P002 unlocked
    const processes2 = await getProcesses(project.id);
    expect(processes2.find(p => p.node_code === 'P002').status).to.not.equal('locked');
    
    // 6. Add material checkin
    await checkinMaterial(project.id, {material_code: 'M001', quantity: 900});
    
    // 7. Add worker and attendance
    const worker = await addWorker(project.id, {name: 'John', daily_wage: 500});
    await checkInAttendance(worker.id, '2024-01-15');
    
    // 8. Generate cost report
    const report = await getCostReport(project.id);
    expect(report.planned.material).to.be.greaterThan(0);
    expect(report.actual.labor).to.be.greaterThan(0);
  });
  
  it('Rejects checkin if previous process not approved', async () => {
    // Attempt P003 before P002 approved
    const res = await checkinProcess(3, {base_data: {...}, photos: [...]});
    expect(res.status).to.equal(422);
    expect(res.body.message).to.include('前序工序');
  });
  
  it('Returns processes in correct language', async () => {
    const processesZh = await getProcesses(1, 'zh');
    expect(processesZh[0].name).to.equal('地基开挖');
    
    const processesTh = await getProcesses(1, 'th');
    expect(processesTh[0].name).to.equal('ขุดฐานราก');
  });
});
```

---

### NIT-1: Inconsistent Field Naming Convention

**Location**: Throughout database schema

**Problem**: 
- Some fields use `snake_case`: `worker_quota`, `base_data_schema`
- Some use single word: `workload`, `productivity`
- JSONB keys mix conventions: `loss_rate` vs `lossRate`

**Fix**: Document convention in design-database.md:
```markdown
## Naming Conventions

- PostgreSQL columns: `snake_case` (e.g., `worker_quota`, `created_at`)
- JSONB object keys: `snake_case` for stored data (e.g., `loss_rate`), `camelCase` for API responses
- JavaScript variables: `camelCase` (e.g., `workerCount`, `materialCode`)
```

---

### NIT-2: Missing Index on process_nodes.name_i18n

**Location**: Design-database.md section 7 "Index Optimization"

**Problem**: Section 3.1 adds a GIN index on `material_library.category_i18n`, but `process_nodes.name_i18n` has no index despite being queried with language parameter in `GET /api/processes?lang=zh`

**Fix**: Add to section 7:
```sql
-- Index for language-specific process name queries
CREATE INDEX IF NOT EXISTS idx_process_nodes_name_i18n ON process_nodes USING GIN (name_i18n);
```

---

### NIT-3: Hardcoded Bangkok Timezone in Watermark

**Location**: Section 5.5 watermark code

**Problem**:
```javascript
const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Bangkok' });
```

Hardcodes Bangkok timezone. If project is in Chiang Mai or Phuket (same timezone but different implicit context), no issue. If system expands to Myanmar/Laos, this breaks.

**Fix**: Use project-level timezone:
```javascript
const timestamp = new Date().toLocaleString('zh-CN', { 
  timeZone: req.project?.timeZone || 'Asia/Bangkok'  // Default to Bangkok
});
```

---

### NIT-4: process_nodes.estimated_days Defaults to 1

**Location**: Design-database.md section 2.1

**Problem**: Default value is 1 day, but if data import forgets to set it, all 31 processes show 1-day estimates, causing incorrect worker calculations.

**Fix**: Change constraint:
```sql
ALTER TABLE process_nodes
  ADD COLUMN estimated_days INTEGER NOT NULL;  -- Remove DEFAULT 1
  
-- Force explicit values during data import
```

---

## Verified Assumptions

✅ **ResponseUtil.success/error exists**: Confirmed at `backend/src/utils/response.js`  
✅ **JWT auth middleware exists**: Confirmed at `backend/src/middlewares/auth.js`  
✅ **Database connection config exists**: Confirmed at `backend/src/config/db.js`  
✅ **31 processes data complete**: Confirmed in `design-data-31-processes.json` with full schema  
✅ **50 materials data complete**: Confirmed in `design-data-50-materials.json` with prices  
✅ **30 tools data complete**: Mentioned in design, file exists (`design-data-30-tools.json`)  
✅ **Database schema constraints**: CHECK constraints for i18n completeness are specified  
✅ **Multer for file upload**: Standard Express middleware, compatible with design  

---

## Unverified Assumptions (Design Claims, Not Verified in Code)

❌ **"Existing auth.js handles JWT"**: Partially true - auth.js EXISTS and validates JWT, but does NOT extract `projectId` as design claims in section 1.2. Actual code extracts `userId`, `username`, `role` only. Design's API examples show `projectId` in token but this field is not in actual middleware.

❌ **"16 existing processes to extend to 31"**: Design claims existing system has 16 processes. Cannot verify without seeing actual database data or process_nodes table contents. Design should specify: "If fewer than 16 exist, import all 31 from scratch."

❌ **"Materialized view refresh every hour"**: Design mentions "定期刷新（每小时）" but provides no cron job, pg_cron configuration, or scheduled task. Implementation must add this.

❌ **"PM2 manages backend with --max-old-space-size=768"**: Deployment detail not verifiable in code review. Should be in `ecosystem.config.js` or deploy script.

❌ **"Domain winaii.com connected"**: Deployment/DNS detail, outside code scope.

---

## Wrong Assumptions (Design States X, Reality is Y)

❌ **"Reuse existing process.service.js, worker.service.js, report.service.js"**: These files DO NOT EXIST. Must be created from scratch (see HIGH-1).

❌ **"material_records has planned_quantity field"**: The field is NOT in design-database.md schema but IS used in trigger logic (see MEDIUM-4).

---

## Recommendations

1. **HIGH Priority**: Resolve all HIGH findings before implementation. Clarify service file creation strategy and API error handling.

2. **Database Migration**: The schema is well-specified. Migration from 16→31 processes should use transaction with rollback capability. Add `design-database.md` section for rollback script.

3. **Calculation Formulas**: The formulas in design-calculations.md are clear and computable. No changes needed for logic, but add error handling for edge cases (MEDIUM-2).

4. **Frontend Modules**: 12 HTML pages are listed but no wireframes or component hierarchy. Consider adding a UI flow diagram showing navigation between modules.

5. **Testing**: Expand integration tests to cover the full AC-5 flow (MEDIUM-5).

6. **Documentation**: Add API reference doc with cURL examples for each endpoint (currently only endpoint list, no request/response samples beyond checkin).

---

## Conclusion

The design is thorough in database schema and calculation logic, but has critical gaps in API error handling, service file architecture, and validation rules. The trilingual i18n system is well-designed with proper constraints. After addressing the 3 HIGH and 5 MEDIUM findings, the design will be ready for implementation.

**Next Step**: Design author should revise sections 1.2, 4.2, 4.3, 3.4, and 5.5, then re-submit for approval.

