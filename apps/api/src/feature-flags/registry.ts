/**
 * Canonical Feature Flag Registry — single source of truth for all flag definitions.
 *
 * Rules:
 * - Every flag MUST be defined here before being used in code or stored in DB.
 * - `status: 'implemented'` → fully built, toggle has runtime effect.
 * - `status: 'planned'` → placeholder only, must be listed in Admin UI but CANNOT be toggled (no runtime effect yet).
 * - `status: 'deprecated'` → keep in registry for DB migration; hidden in Admin UI by default.
 * - Module kill-switches (group: 'main-apps') cascade: if module.X is OFF, all dependsOn:[module.X] flags are effectively OFF.
 */

export type FeatureFlagStatus = 'implemented' | 'planned' | 'scaffold' | 'deprecated';
export type FeatureFlagBuildStatus = 'built' | 'scaffold' | 'planned';
export type FeatureFlagValueType = 'boolean' | 'enum';
export type FeatureFlagApp = 'core' | 'lims' | 'opd' | 'rad' | 'ipd' | 'printing';
export type FeatureFlagGroup = 'main-apps' | 'app-features';

export interface FeatureFlagDefinition {
  key: string;
  app: FeatureFlagApp;
  group: FeatureFlagGroup;
  label: string;
  description: string;
  valueType: FeatureFlagValueType;
  status: FeatureFlagStatus;
  buildStatus: FeatureFlagBuildStatus;
  /** Default value when no tenant override exists (true = enabled) */
  defaultValue: boolean;
  /** Keys that must be ON for this flag to have any effect */
  dependsOn?: string[];
  /** Only for valueType: 'enum' */
  enumOptions?: string[];
}

export const FEATURE_FLAG_REGISTRY: FeatureFlagDefinition[] = [
  // ─── Main apps ─────────────────────────────────────────────────────────────
  {
    key: 'module.lims',
    app: 'lims',
    group: 'main-apps',
    label: 'LIMS',
    description: 'Laboratory Information Management System — full lab workflow (registration, sample collection, results, verification, reports).',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'built',
    defaultValue: true,
  },
  {
    key: 'module.opd',
    app: 'opd',
    group: 'main-apps',
    label: 'OPD',
    description: 'Outpatient Department — appointments, clinical notes, prescriptions, billing.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'scaffold',
    defaultValue: false,
  },
  {
    key: 'module.rad',
    app: 'rad',
    group: 'main-apps',
    label: 'Radiology',
    description: 'Radiology (RAD) module — imaging orders, worklist, reporting.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'scaffold',
    defaultValue: false,
  },
  {
    key: 'module.ipd',
    app: 'ipd',
    group: 'main-apps',
    label: 'IPD',
    description: 'Inpatient Department — ward management, bed tracking, discharge summaries.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'scaffold',
    defaultValue: false,
  },
  {
    key: 'module.printing',
    app: 'printing',
    group: 'main-apps',
    label: 'Printing',
    description: 'Printing module — A4 and thermal receipt/report printing.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'built',
    defaultValue: true,
  },

  // ─── LIMS features ─────────────────────────────────────────────────────────
  {
    key: 'lims.verification.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Verification Step',
    description:
      'Enable the verification step before publishing reports. ' +
      'OFF = results auto-publish on submit (no separate verifier needed). ' +
      'ON = a verifier must approve results in the Verification worklist.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'built',
    defaultValue: true,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.verification.mode',
    app: 'lims',
    group: 'app-features',
    label: 'Verification Mode',
    description:
      'How verification is performed when enabled. ' +
      '"separate" = dedicated Verification worklist page. ' +
      '"inline" = operators can Submit & Verify in one action on the results entry screen.',
    valueType: 'enum',
    enumOptions: ['separate', 'inline'],
    status: 'implemented',
    buildStatus: 'built',
    defaultValue: true,
    dependsOn: ['module.lims', 'lims.verification.enabled'],
  },
  {
    key: 'lims.operator.sample.receiveSeparate.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Separate Specimen Receive Step',
    description:
      'When ON: Sample Collection shows two separate tabs — Collect and Receive. ' +
      'When OFF: single combined collect+receive step.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'built',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.operator.barcode.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Barcode Scanning',
    description: 'Enable barcode scanner input in sample collection workflow.',
    valueType: 'boolean',
    status: 'implemented',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.printing.results',
    app: 'lims',
    group: 'app-features',
    label: 'Print from Results',
    description: 'Allow printing results directly from the result entry screen.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims', 'module.printing'],
  },
  {
    key: 'lims.barcode.labels',
    app: 'lims',
    group: 'app-features',
    label: 'Barcode Labels',
    description: 'Generate and print barcode labels for specimen tubes.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.qc.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Quality Control (QC)',
    description: 'Enable QC/LQC management for result validation.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.delta_checks.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Delta Checks',
    description: 'Flag results that deviate significantly from the patient\'s previous values.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.outsource.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Outsource Tests',
    description: 'Route selected tests to external reference laboratories.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.microbiology.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Microbiology',
    description: 'Microbiology-specific result entry workflows (cultures, sensitivity).',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.blood_bank.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Blood Bank',
    description: 'Blood bank module integration placeholder.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },

  // ─── OPD features ──────────────────────────────────────────────────────────
  {
    key: 'opd.providers',
    app: 'opd',
    group: 'app-features',
    label: 'Providers',
    description: 'Manage OPD providers/doctors and their profiles.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.appointments',
    app: 'opd',
    group: 'app-features',
    label: 'Appointments',
    description: 'OPD appointment booking and management.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.scheduling',
    app: 'opd',
    group: 'app-features',
    label: 'Scheduling',
    description: 'Doctor schedule and appointment slot management.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.vitals',
    app: 'opd',
    group: 'app-features',
    label: 'Vitals',
    description: 'Record and track patient vitals at OPD visit.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.clinical_note',
    app: 'opd',
    group: 'app-features',
    label: 'Clinical Notes',
    description: 'Structured or free-text clinical notes for OPD encounters.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.prescription_free_text',
    app: 'opd',
    group: 'app-features',
    label: 'Free-text Prescription',
    description: 'Allow free-text prescription entry for OPD consultations.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.billing',
    app: 'opd',
    group: 'app-features',
    label: 'Billing',
    description: 'OPD billing and invoicing.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },
  {
    key: 'opd.invoice_receipt_pdf',
    app: 'opd',
    group: 'app-features',
    label: 'Invoice/Receipt PDF',
    description: 'Generate PDF invoice and receipt for OPD billing.',
    valueType: 'boolean',
    status: 'planned',
    buildStatus: 'scaffold',
    defaultValue: false,
    dependsOn: ['module.opd'],
  },

  // ─── Deprecated (kept for migration reference) ─────────────────────────────
  {
    key: 'lims.auto_verify',
    app: 'lims',
    group: 'app-features',
    label: 'Auto-Verify (deprecated)',
    description: 'Deprecated. Use lims.verification.enabled=false for the same effect.',
    valueType: 'boolean',
    status: 'deprecated',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.print_results',
    app: 'lims',
    group: 'app-features',
    label: 'Print Results (deprecated)',
    description: 'Deprecated. Use lims.printing.results.',
    valueType: 'boolean',
    status: 'deprecated',
    buildStatus: 'planned',
    defaultValue: false,
    dependsOn: ['module.lims'],
  },
  {
    key: 'lims.operator.verificationPages.enabled',
    app: 'lims',
    group: 'app-features',
    label: 'Verification Pages Visible (deprecated)',
    description: 'Deprecated. Now controlled by lims.verification.enabled directly.',
    valueType: 'boolean',
    status: 'deprecated',
    buildStatus: 'planned',
    defaultValue: true,
    dependsOn: ['module.lims'],
  },
];

/** Build a default values map from the registry */
export function buildFlagDefaults(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const def of FEATURE_FLAG_REGISTRY) {
    if (def.valueType === 'boolean') {
      defaults[def.key] = def.defaultValue;
    }
  }
  return defaults;
}

/** Lookup a definition by key */
export function getFlagDefinition(key: string): FeatureFlagDefinition | undefined {
  return FEATURE_FLAG_REGISTRY.find((d) => d.key === key);
}
