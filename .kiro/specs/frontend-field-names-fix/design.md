# Frontend Field Names Fix - Bugfix Design

## Overview

The 7 frontend HTML files are using incorrect field names and API endpoints that don't match the new database schema (`final-database-schema.sql`). This causes API calls to fail and forms to not submit data properly. The fix involves updating all field references, API endpoint paths, and data structures to align with the actual backend implementation and database columns.

**Impact**: All 7 HTML files (projects.html, project-detail.html, workers.html, materials.html, attendance.html, processes.html, index.html) are affected. Users cannot successfully create or view data due to mismatched field names.

**Strategy**: Systematically update each HTML file to use correct field names from the database schema, correct API endpoints from the backend routes, and ensure data structures match what the backend expects.

## Glossary

- **Bug_Condition (C)**: Frontend code references field names or API endpoints that don't exist in the backend/database
- **Property (P)**: Frontend field names and API calls match the actual backend implementation
- **Preservation**: Existing UI/UX, styling, and workflow logic must remain unchanged
- **Field Name Mismatch**: Frontend uses `address` but backend expects `location`
- **API Endpoint Mismatch**: Frontend calls `/api/projects/:id/processes` but backend has `/api/nodes`
- **projects table**: Defined in `final-database-schema.sql` - uses `location` not `address`, `project_name` not `name`
- **workers table**: Uses `worker_id` as primary key, `name` for worker name, `role` for job type
- **process_nodes table**: Global shared process template - no `project_id`, uses `node_name` and `node_code`
- **material_library table**: Global shared materials - uses `material_name`, `material_code`, `default_unit`
- **project_materials table**: Project-specific material records - uses `material_name`, `received_quantity`, `planned_quantity`
- **daily_attendance table**: Uses `attendance_date`, `worker_id`, `hours_worked`, `status`

## Bug Details

### Bug Condition

The bug manifests when users interact with any of the 7 frontend HTML forms. Forms either fail to submit, display incorrect data, or show errors because field names don't match the database schema and API endpoints don't exist in the backend.

**Formal Specification:**
```
FUNCTION isBugCondition(formSubmission)
  INPUT: formSubmission of type HTTPRequest from frontend HTML
  OUTPUT: boolean
  
  RETURN (formSubmission.fieldNames NOT IN database.columnNames)
         OR (formSubmission.apiEndpoint NOT IN backend.routes)
         OR (formSubmission.dataStructure != backend.expectedStructure)
END FUNCTION
```

### Examples

**Projects Page (`projects.html`):**
- **Bug**: Form uses `name="address"` but database table has `location` column
- **Bug**: Form uses `name="client_name"` but this field doesn't exist in the simplified schema
- **Bug**: API calls expect `project_name` but may be sending `name`
- **Expected**: Form should use `location` field matching database schema

**Project Detail (`project-detail.html`):**
- **Bug**: Tries to access `project.address` but database has `location`
- **Bug**: References `project.client_name` and `project.client_phone` which don't exist
- **Bug**: API endpoint `/api/projects/${projectId}/processes` may not match backend routing
- **Expected**: Should display `project.location` and use correct API endpoints

**Workers Page (`workers.html`):**
- **Bug**: References `worker.join_date` but database uses `created_at`
- **Bug**: Form uses generic field names that may not match backend expectations
- **Bug**: Worker ID field may not correctly reference `worker_id` primary key
- **Expected**: Should use `created_at` for display and `worker_id` for identification

**Materials Page (`materials.html`):**
- **Bug**: API endpoint `/api/materials/library` may not exist in backend
- **Bug**: Form field names may not match `project_materials` table columns
- **Bug**: References `standard_price` which doesn't exist in `material_library`
- **Bug**: Receive material endpoint `/api/materials/:id/receive` may not exist
- **Expected**: Should use correct material library API and field names from schema

**Attendance Page (`attendance.html`):**
- **Bug**: Form uses `name="date"` but database has `attendance_date`
- **Bug**: Form uses `name="work_hours"` but database has `hours_worked`
- **Bug**: References `worker.worker_role` inconsistently
- **Bug**: API endpoint structure may not match backend implementation
- **Expected**: Should use `attendance_date` and `hours_worked` matching schema

**Processes Page (`processes.html`):**
- **Bug**: References `process.code` but database has `node_code` in `process_nodes`
- **Bug**: API endpoint `/api/processes/library` may not match backend
- **Bug**: Uses `process.name.zh` structure which may not match backend response
- **Bug**: Checkin endpoint `/api/processes/:id/checkin` may not align with backend
- **Bug**: References `node_id` inconsistently
- **Expected**: Should use correct process_nodes field names and API endpoints

**Login Page (`index.html`):**
- **Bug**: May have minor authentication flow issues
- **Expected**: Verify JWT token handling and user data storage match backend

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing UI layouts, styling, and visual design must remain exactly the same
- User workflow and interaction patterns (clicking buttons, filling forms, navigation) must not change
- Modal dialogs should open and close the same way
- Loading states and empty states should display identically
- Form validation logic (required fields, etc.) should remain the same
- Navigation between pages should work identically

**Scope:**
All changes are internal to data handling only. If the UI currently shows a field labeled "地址" (Address), it should continue to show that label - only the underlying field name in the code should change from `address` to `location`. Users should not notice any difference except that forms now actually work correctly.

## Hypothesized Root Cause

Based on the bug description and examination of the code, the most likely issues are:

1. **Schema Evolution Mismatch**: The frontend HTML files were created for an older database schema version. The `final-database-schema.sql` represents a simplified v2.0 schema, but the frontend still references v1.0 field names like `address` instead of `location`, `client_name` instead of removing it entirely.

2. **API Route Documentation Gap**: The frontend developers assumed API endpoints that don't match the actual backend implementation in `backend/src/routes/`. For example, frontend expects RESTful patterns like `/api/materials/library` but backend may have different routing structure.

3. **Field Name Inconsistencies**: Database uses compound names like `attendance_date` and `hours_worked`, but frontend forms use simplified names like `date` and `work_hours`. The backend expects exact database column names.

4. **Missing Backend Documentation**: The `simple-backend-architecture.md` shows planned API endpoints, but the actual implementation in `backend/src/routes/` may differ. Frontend is using documented endpoints that weren't implemented.

## Correctness Properties

Property 1: Bug Condition - Field Names Match Database Schema

_For any_ form submission from the 7 frontend HTML files where field names and API endpoints are corrected, the backend SHALL accept the request, process the data correctly, and return success responses with properly formatted data.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - UI/UX Unchanged

_For any_ user interaction with the frontend (viewing pages, clicking buttons, filling forms, navigating), the fixed code SHALL produce exactly the same visual appearance and user experience as the original code, preserving all styling, layouts, workflows, and user-facing text.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the following changes are needed:

#### File 1: `frontend-web/projects.html`

**Function**: Project list and creation form

**Specific Changes**:
1. **Form Field Update**: Change `name="address"` to `name="location"` in create project form (line ~247)
2. **Remove Unused Fields**: Remove `client_name` field from create form (not in schema)
3. **Display Field Update**: Change `project.address` to `project.location` in display template (line ~275)
4. **Data Structure**: Ensure createProject function sends `location` not `address` (line ~312)
5. **Remove Client Fields**: Remove references to `client_name` and `client_phone` from display (lines ~276-280)

#### File 2: `frontend-web/project-detail.html`

**Function**: Project detail view with quick action links

**Specific Changes**:
1. **Display Property**: Change `project.location` reference (already correct) but verify it displays properly
2. **Remove Client Fields**: Remove `client_name` and `client_phone` from meta display (lines ~221-228)
3. **API Endpoint**: Verify `/api/projects/${projectId}` returns correct field names
4. **Navigation Links**: Ensure all quick action links use correct query parameters

#### File 3: `frontend-web/workers.html`

**Function**: Worker management - list and add workers

**Specific Changes**:
1. **Display Date Field**: Change `worker.join_date` to `worker.created_at` in display (line ~422)
2. **Primary Key Reference**: Ensure all worker references use `worker_id` not `id`
3. **API Endpoint**: Verify `/api/projects/${projectId}/workers` matches backend routing
4. **Form Data**: Ensure addWorker sends data matching workers table columns

#### File 4: `frontend-web/materials.html`

**Function**: Material management - plan materials and record receipts

**Specific Changes**:
1. **API Endpoint**: Update material library endpoint to match backend (currently `/api/materials/library`)
2. **Field Names**: Change `standard_price` reference to use correct field from material_library table
3. **Project Materials Fields**: Ensure form uses `planned_quantity`, `received_quantity` from project_materials table
4. **Receive Endpoint**: Verify `/api/materials/:id/receive` endpoint exists in backend
5. **Display Fields**: Use `material_name` consistently from both material_library and project_materials

#### File 5: `frontend-web/attendance.html`

**Function**: Daily attendance tracking

**Specific Changes**:
1. **Form Field**: Change `name="date"` to `name="attendance_date"` (line ~304)
2. **Hours Field**: Change `name="work_hours"` to `name="hours_worked"` (line ~311)
3. **Display Fields**: Update display to use `attendance_date` and `hours_worked` (lines ~286-290)
4. **API Endpoint**: Verify attendance endpoints match backend routing structure
5. **Worker Reference**: Ensure `worker_id` is used correctly in form submission

#### File 6: `frontend-web/processes.html`

**Function**: Process/node management and checkin

**Specific Changes**:
1. **Field Names**: Use `node_code` instead of `process.code` from process_nodes table
2. **API Endpoint**: Update `/api/processes/library` to match actual backend route (may be `/api/nodes/library`)
3. **Checkin Endpoint**: Verify `/api/processes/:id/checkin` or change to match backend (may be `/api/nodes/:id/checkin`)
4. **Display Fields**: Use `node_name` for display instead of `process.name.zh`
5. **Primary Key**: Ensure using `node_id` as the identifier
6. **Response Structure**: Adjust to handle backend response format (may not have nested `name.zh` structure)

#### File 7: `frontend-web/index.html`

**Function**: Login page

**Specific Changes**:
1. **Verify Token Storage**: Ensure token and user data are stored with correct field names
2. **User Object Structure**: Verify `user.fullName` or `user.full_name` matches backend response
3. **API Response**: Ensure login response parsing matches backend JWT structure

### General Changes Across All Files:

1. **Consistent API Base**: Verify all files use same `API_BASE` constant (currently `/api`)
2. **Error Handling**: Ensure error messages display backend validation errors correctly
3. **Response Parsing**: Update all `result.data` access to match backend response structure
4. **Date Formatting**: Ensure date fields use correct format for database (ISO 8601)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Attempt to submit forms and make API calls using the UNFIXED code against the actual backend. Observe failures and capture the exact error messages returned. Check browser console for 400/404 errors and inspect network requests to see which field names are being sent vs. what backend expects.

**Test Cases**:
1. **Create Project Test**: Submit create project form with `address` field (will fail - backend expects `location`)
2. **Add Worker Test**: Submit add worker form and check if `worker_id` vs `id` causes issues (may fail)
3. **Record Attendance Test**: Submit attendance with `date` and `work_hours` (will fail - backend expects `attendance_date` and `hours_worked`)
4. **Material Library Load Test**: Try to load `/api/materials/library` (may fail with 404 if endpoint doesn't exist)
5. **Process Library Load Test**: Try to load `/api/processes/library` (may fail - might need `/api/nodes/library`)
6. **Add Process Test**: Submit add process form with wrong field names (will fail)

**Expected Counterexamples**:
- HTTP 400 errors with messages like "Missing required field: location"
- HTTP 404 errors for non-existent API endpoints
- Database errors about unknown columns
- Possible causes: field name mismatches, wrong API routes, incorrect data structure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL formSubmission WHERE isBugCondition(formSubmission) DO
  result := submitForm_fixed(formSubmission)
  ASSERT result.success === true
  ASSERT result.data.fieldNames === database.columnNames
  ASSERT backend.received(correctFieldNames)
END FOR
```

**Testing Approach**: After fixing each HTML file, manually test all forms:
1. Create project with `location` field - should succeed
2. Add worker and verify `created_at` displays correctly
3. Record attendance with `attendance_date` and `hours_worked` - should succeed
4. Load material library with correct endpoint - should return data
5. Load process library with correct endpoint - should return data
6. Add process/node with correct field names - should succeed

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL userInteraction WHERE NOT isBugCondition(userInteraction) DO
  ASSERT originalUI.appearance = fixedUI.appearance
  ASSERT originalUI.behavior = fixedUI.behavior
  ASSERT originalUI.styling = fixedUI.styling
END FOR
```

**Testing Approach**: Visual regression testing is recommended for preservation checking because:
- It catches unintended styling changes that manual testing might miss
- It provides visual proof that UI is unchanged
- It verifies that all CSS classes and layouts remain identical

**Test Plan**: Before making changes, take screenshots of all pages in different states (empty, with data, modals open, etc.). After fix, compare screenshots pixel-by-pixel.

**Test Cases**:
1. **Page Layout Preservation**: Verify projects.html grid layout, colors, spacing unchanged
2. **Modal Dialog Preservation**: Verify all modals open/close identically with same styling
3. **Button Styling Preservation**: Verify all buttons look identical (gradients, shadows, hover effects)
4. **Form Layout Preservation**: Verify form fields, labels, spacing remain unchanged
5. **Loading States Preservation**: Verify spinners and loading messages appear identically
6. **Empty States Preservation**: Verify empty state messages and icons display the same
7. **Navigation Preservation**: Verify all links and back buttons work the same way

### Unit Tests

Since this is a pure frontend bug fix with no testing framework currently in place:
- Manual testing of each form submission
- Browser console inspection for errors
- Network tab inspection to verify correct field names in requests
- Database inspection to verify records are created with correct values

### Property-Based Tests

Property-based testing is not applicable for this bug fix because:
- This is a deterministic field name mapping issue, not algorithmic
- Each field has exactly one correct name (no fuzzing needed)
- Frontend has no existing test infrastructure

Instead, use systematic manual testing with a checklist:
- Test each form in each HTML file
- Verify each API endpoint returns data
- Check each display field shows correct value

### Integration Tests

- **Test full project creation flow**: Login → Create project → View project detail → Verify data in database
- **Test full worker flow**: Navigate to workers → Add worker → View worker list → Verify `created_at` displays
- **Test full attendance flow**: Navigate to attendance → Record attendance → View attendance list → Verify correct date format
- **Test full material flow**: Navigate to materials → Add material → Record receipt → View material list
- **Test full process flow**: Navigate to processes → Add process → Start process → Complete process → Verify status updates
- **Test cross-page navigation**: Verify all links between pages work and carry correct query parameters
