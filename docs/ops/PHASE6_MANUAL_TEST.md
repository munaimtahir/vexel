# Phase 6 Manual Test Script — Operator Workflow

## Prerequisites
- Stack running: `docker compose up -d`
- Admin user seeded: admin@vexel.system / Admin@vexel123!
- Operator app accessible at http://localhost:9024 (or https://vexel.alshifalab.pk)

## Step 1 — Login
1. Navigate to /login
2. Enter credentials
3. Confirm redirect to /encounters

## Step 2 — Create Patient
1. Navigate to /patients/new
2. Fill: First Name, Last Name, MRN (e.g. MRN-001), Gender
3. Click "Create Patient"
4. Confirm redirect to /patients

## Step 3 — Create Encounter
1. Navigate to /encounters/new
2. Select the patient created in Step 2
3. Click "Register Encounter"
4. Confirm redirect to encounter detail

## Step 4 — Order Lab
1. On encounter detail: click "Order Lab" (if available) OR navigate to /encounters/:id
2. Confirm encounter status = lab_ordered

## Step 5 — Enter Results
1. Click "Enter Results" → navigates to /encounters/:id/results
2. Enter value for each lab order
3. Click "Submit Results"
4. Confirm encounter status = resulted

## Step 6 — Verify
1. Click "Verify Results" → navigates to /encounters/:id/verify
2. Review read-only table
3. Click "Confirm Verify"
4. Confirm redirect to /encounters/:id/publish

## Step 7 — Generate Report
1. On publish page: click "Generate Lab Report"
2. Observe status: RENDERING → RENDERED
3. Click "Publish Document"
4. Click "Download PDF"
5. Confirm PDF opens in browser

## Expected Final State
- Encounter status: verified
- Document status: PUBLISHED
- Document has payloadHash and pdfHash set
- Audit events exist for: encounter.result, encounter.verify, document.generate, document.publish
