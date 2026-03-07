/**
 * Block Registry — defines all available block types, their default props,
 * and prop schema validation for HYBRID_TEMPLATE layouts.
 *
 * Rules enforced here:
 * - Block types are a closed enum — unknown types are rejected
 * - Each block has a stable set of props (extra props are allowed but irrelevant)
 * - Required props are validated at save/preview time
 */

export const BLOCK_TYPES = [
  'HEADER',
  'DEMOGRAPHICS',
  'PARAMETER_TABLE',
  'NARRATIVE_SECTION',
  'GRAPH_SCALE',
  'IMAGE_GRID',
  'SIGNATURE_BLOCK',
  'DISCLAIMER',
  'SPACER',
  'SECTION_TITLE',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  icon: string;                      // Lucide icon name for the Studio UI
  defaultProps: Record<string, unknown>;
  requiredProps: string[];
  allowedPropsSchema: Record<string, PropSchema>;
}

export interface PropSchema {
  type: 'string' | 'boolean' | 'number' | 'enum';
  enumValues?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

// ─── Block Props Interfaces ───────────────────────────────────────────────────

export interface HeaderBlockProps {
  showLogo: boolean;
  title: string;
  subtitle: string;
  alignment: 'left' | 'center' | 'right';
}

export interface DemographicsBlockProps {
  columns: 1 | 2 | 3;
  showMrn: boolean;
  showAge: boolean;
  showGender: boolean;
  showDob: boolean;
  showEncounterCode: boolean;
  showReportDate: boolean;
}

export interface ParameterTableBlockProps {
  source: string;
  showUnits: boolean;
  showReferenceRange: boolean;
  showFlag: boolean;
  groupByTest: boolean;
  showTestHeader: boolean;
}

export interface NarrativeSectionBlockProps {
  title: string;
  field: string;
  showBorder: boolean;
}

export interface GraphScaleBlockProps {
  title: string;
  parameterConfigKey: string;   // references a key in graphical scale config
  showSummary: boolean;
}

export interface ImageGridBlockProps {
  columns: 1 | 2 | 3;
  maxImages: number;
  field: string;
  caption: string;
}

export interface SignatureBlockProps {
  showName: boolean;
  showQualification: boolean;
  showDate: boolean;
  label: string;
}

export interface DisclaimerBlockProps {
  text: string;                  // overrides branding disclaimer if non-empty
  useSystemDisclaimer: boolean;
}

export interface SpacerBlockProps {
  height: number;               // in points (1pt = 1/72 inch)
}

export interface SectionTitleBlockProps {
  text: string;
  level: 1 | 2 | 3;
  showDivider: boolean;
}

// ─── Block Registry Entries ───────────────────────────────────────────────────

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  HEADER: {
    type: 'HEADER',
    label: 'Header',
    description: 'Report header with brand name, logo, and report title',
    icon: 'Building2',
    defaultProps: {
      showLogo: true,
      title: '',
      subtitle: '',
      alignment: 'left',
    } as Record<string, unknown>,
    requiredProps: [],
    allowedPropsSchema: {
      showLogo:  { type: 'boolean' },
      title:     { type: 'string' },
      subtitle:  { type: 'string' },
      alignment: { type: 'enum', enumValues: ['left', 'center', 'right'] },
    },
  },

  DEMOGRAPHICS: {
    type: 'DEMOGRAPHICS',
    label: 'Demographics',
    description: 'Patient demographics block (name, MRN, age, gender, etc.)',
    icon: 'User',
    defaultProps: {
      columns: 2,
      showMrn: true,
      showAge: true,
      showGender: true,
      showDob: false,
      showEncounterCode: true,
      showReportDate: true,
    } as Record<string, unknown>,
    requiredProps: [],
    allowedPropsSchema: {
      columns:           { type: 'enum', enumValues: ['1', '2', '3'] },
      showMrn:           { type: 'boolean' },
      showAge:           { type: 'boolean' },
      showGender:        { type: 'boolean' },
      showDob:           { type: 'boolean' },
      showEncounterCode: { type: 'boolean' },
      showReportDate:    { type: 'boolean' },
    },
  },

  PARAMETER_TABLE: {
    type: 'PARAMETER_TABLE',
    label: 'Parameter Table',
    description: 'Lab result parameters in tabular format',
    icon: 'Table2',
    defaultProps: {
      source: 'test.parameters',
      showUnits: true,
      showReferenceRange: true,
      showFlag: true,
      groupByTest: true,
      showTestHeader: true,
    } as Record<string, unknown>,
    requiredProps: ['source'],
    allowedPropsSchema: {
      source:             { type: 'string', required: true },
      showUnits:          { type: 'boolean' },
      showReferenceRange: { type: 'boolean' },
      showFlag:           { type: 'boolean' },
      groupByTest:        { type: 'boolean' },
      showTestHeader:     { type: 'boolean' },
    },
  },

  NARRATIVE_SECTION: {
    type: 'NARRATIVE_SECTION',
    label: 'Narrative Section',
    description: 'Free-text narrative or interpretation section',
    icon: 'FileText',
    defaultProps: {
      title: 'Impression',
      field: 'interpretation',
      showBorder: true,
    } as Record<string, unknown>,
    requiredProps: ['field'],
    allowedPropsSchema: {
      title:      { type: 'string' },
      field:      { type: 'string', required: true },
      showBorder: { type: 'boolean' },
    },
  },

  GRAPH_SCALE: {
    type: 'GRAPH_SCALE',
    label: 'Graph Scale',
    description: 'Visual scale / band interpretation chart',
    icon: 'BarChart2',
    defaultProps: {
      title: '',
      parameterConfigKey: '',
      showSummary: true,
    } as Record<string, unknown>,
    requiredProps: ['parameterConfigKey'],
    allowedPropsSchema: {
      title:                { type: 'string' },
      parameterConfigKey:   { type: 'string', required: true },
      showSummary:          { type: 'boolean' },
    },
  },

  IMAGE_GRID: {
    type: 'IMAGE_GRID',
    label: 'Image Grid',
    description: 'Grid of attached images (e.g. smear photos)',
    icon: 'Images',
    defaultProps: {
      columns: 2,
      maxImages: 4,
      field: 'images',
      caption: '',
    } as Record<string, unknown>,
    requiredProps: ['field'],
    allowedPropsSchema: {
      columns:   { type: 'enum', enumValues: ['1', '2', '3'] },
      maxImages: { type: 'number', min: 1, max: 12 },
      field:     { type: 'string', required: true },
      caption:   { type: 'string' },
    },
  },

  SIGNATURE_BLOCK: {
    type: 'SIGNATURE_BLOCK',
    label: 'Signature Block',
    description: 'Verified-by / authorized-by signature row',
    icon: 'Pen',
    defaultProps: {
      showName: true,
      showQualification: false,
      showDate: true,
      label: 'Verified By',
    } as Record<string, unknown>,
    requiredProps: [],
    allowedPropsSchema: {
      showName:          { type: 'boolean' },
      showQualification: { type: 'boolean' },
      showDate:          { type: 'boolean' },
      label:             { type: 'string' },
    },
  },

  DISCLAIMER: {
    type: 'DISCLAIMER',
    label: 'Disclaimer',
    description: 'Legal / clinical disclaimer text',
    icon: 'AlertCircle',
    defaultProps: {
      text: '',
      useSystemDisclaimer: true,
    } as Record<string, unknown>,
    requiredProps: [],
    allowedPropsSchema: {
      text:                 { type: 'string' },
      useSystemDisclaimer:  { type: 'boolean' },
    },
  },

  SPACER: {
    type: 'SPACER',
    label: 'Spacer',
    description: 'Vertical whitespace',
    icon: 'Space',
    defaultProps: {
      height: 12,
    } as Record<string, unknown>,
    requiredProps: [],
    allowedPropsSchema: {
      height: { type: 'number', min: 1, max: 200 },
    },
  },

  SECTION_TITLE: {
    type: 'SECTION_TITLE',
    label: 'Section Title',
    description: 'Bold section heading with optional divider',
    icon: 'Heading',
    defaultProps: {
      text: '',
      level: 2,
      showDivider: true,
    } as Record<string, unknown>,
    requiredProps: ['text'],
    allowedPropsSchema: {
      text:        { type: 'string', required: true },
      level:       { type: 'enum', enumValues: ['1', '2', '3'] },
      showDivider: { type: 'boolean' },
    },
  },
};

export function isValidBlockType(type: unknown): type is BlockType {
  return typeof type === 'string' && BLOCK_TYPES.includes(type as BlockType);
}

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_REGISTRY[type];
}

export function getDefaultProps(type: BlockType): Record<string, unknown> {
  return { ...BLOCK_REGISTRY[type].defaultProps };
}
