# Bugfix Requirements Document

## Introduction

After the database schema was rebuilt (final-database-schema.sql), all 7 frontend HTML pages (processes.html, materials.html, workers.html, projects.html, project-detail.html, attendance.html, and index.html) contain field name references that no longer match the new backend API responses. The new API (api.routes.js) returns data fields based on the updated database schema, but the frontend JavaScript code still expects the old field names. This causes data to display as undefined or missing, API calls to use incorrect endpoints, and features to fail silently.

**Impact**: Users cannot view process data correctly, materials fail to load properly, worker information is missing, and project details are incomplete.

**Root Cause**: The database schema migration changed table names and field names (e.g., `process_nodes` table now uses `node_name` instead of `process_name`), but the frontend code was not updated to match these changes.

## Bug Analysis

### Current Behavior (Defect)

**Section 1: Process Field Mismatches**

1.1 WHEN the frontend requests process data from `/projects/:projectId/processes` THEN it expects fields `process_name`, `process_code`, and `node_id` but the API returns `node_name`, `node_code`, and `id`

1.2 WHEN the frontend attempts to check in a process THEN it sends requests to `/processes/:nodeId/checkin` but the correct endpoint is `/projects/:projectId/processes/:processId/checkin`

1.3 WHEN the frontend displays process information THEN it references `process.process_name` and `process.process_code` which are undefined because the API returns `node_name` and `node_code`

1.4 WHEN the frontend accesses process IDs THEN it uses `process.node_id` which is undefined because the API returns `id`

**Section 2: Material Field Mismatches**

2.1 WHEN the frontend displays material library options THEN it expects `material_library.id` to be present but may reference it incorrectly in some contexts

2.2 WHEN the frontend handles material records THEN field names should align with `project_materials` table structure (planned_quantity, received_quantity, unit, unit_price, total_cost, etc.)

**Section 3: Worker Field Mismatches**

3.1 WHEN the frontend accesses worker records THEN it may reference `worker_id` inconsistently with the API response structure

3.2 WHEN the frontend updates or deletes workers THEN it constructs API endpoints using field names that may not match the backend routes

**Section 4: Attendance Field Mismatches**

4.1 WHEN the frontend loads attendance records THEN field references must align with `daily_attendance` table structure

4.2 WHEN the frontend displays worker names in attendance views THEN it must correctly access joined fields from the API response

**Section 5: API Endpoint Mismatches**

5.1 WHEN the frontend makes API calls for process operations THEN it uses `/processes/:id/checkin` instead of the correct `/projects/:projectId/processes/:processId/checkin`

5.2 WHEN the frontend references process library endpoints THEN it attempts to call `/processes/library` which may not exist in the new API

### Expected Behavior (Correct)

**Section 2: Process Field Corrections**

2.1 WHEN the frontend requests process data from `/projects/:projectId/processes` THEN it SHALL correctly access `node_name`, `node_code`, and `id` fields from the API response

2.2 WHEN the frontend attempts to check in a process THEN it SHALL send requests to `/projects/:projectId/processes/:processId/checkin` with the correct projectId and processId parameters

2.3 WHEN the frontend displays process information THEN it SHALL reference `process.node_name` and `process.node_code` to display the correct values

2.4 WHEN the frontend accesses process IDs THEN it SHALL use `process.id` to correctly identify process records

**Section 3: Material Field Corrections**

3.1 WHEN the frontend displays material library data THEN it SHALL correctly access all fields returned by `/materials/library` endpoint (id, material_code, material_name, category, default_unit)

3.2 WHEN the frontend handles project materials THEN it SHALL correctly access all fields from the API response (id, project_id, material_id, material_name, planned_quantity, received_quantity, unit, unit_price, total_cost, planned_date, actual_date, supplier, status, notes)

**Section 4: Worker Field Corrections**

4.1 WHEN the frontend accesses worker records THEN it SHALL correctly use `worker_id` as the primary key in all API calls and data references

4.2 WHEN the frontend updates or deletes workers THEN it SHALL construct API endpoints as `/workers/:workerId` using the correct worker_id value

**Section 5: Attendance Field Corrections**

5.1 WHEN the frontend loads attendance records THEN it SHALL correctly access fields from the `daily_attendance` table (id, project_id, worker_id, attendance_date, status, hours_worked, notes, created_by, created_at)

5.2 WHEN the frontend displays worker information in attendance views THEN it SHALL correctly access joined fields (worker_name, worker_role, daily_wage) returned by the API

**Section 6: API Endpoint Corrections**

6.1 WHEN the frontend makes API calls for process check-in THEN it SHALL use the correct endpoint format `/projects/:projectId/processes/:processId/checkin` with action parameter

6.2 WHEN the frontend loads standard processes THEN it SHALL call `/processes` endpoint (not `/processes/library`) and correctly handle the response structure

### Unchanged Behavior (Regression Prevention)

**Section 3: API Response Structure Preservation**

3.1 WHEN the frontend receives successful API responses THEN the system SHALL CONTINUE TO check for `result.success` and access data via `result.data`

3.2 WHEN the frontend handles API errors THEN the system SHALL CONTINUE TO access error messages via `result.message`

3.3 WHEN the frontend uses authentication THEN the system SHALL CONTINUE TO send the token in the Authorization header as `Bearer ${token}`

**Section 4: UI Behavior Preservation**

4.1 WHEN users interact with modals and forms THEN the system SHALL CONTINUE TO display the same UI components and interactions

4.2 WHEN users filter or sort data THEN the system SHALL CONTINUE TO provide the same filtering and sorting functionality

4.3 WHEN users navigate between pages THEN the system SHALL CONTINUE TO preserve projectId in URL parameters and use the same navigation patterns

**Section 5: Data Display Preservation**

5.1 WHEN the frontend displays status badges THEN the system SHALL CONTINUE TO use the same status mapping and styling

5.2 WHEN the frontend calculates derived values (percentages, totals, counts) THEN the system SHALL CONTINUE TO use the same calculation logic with corrected field names

5.3 WHEN the frontend renders empty states or loading indicators THEN the system SHALL CONTINUE TO show the same user feedback messages
