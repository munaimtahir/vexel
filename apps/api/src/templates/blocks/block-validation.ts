import { BLOCK_REGISTRY, BLOCK_TYPES, BlockType, isValidBlockType, PropSchema } from './block-registry';

export const MAX_LAYOUT_BLOCKS = 50;
export const MAX_LAYOUT_BYTES = 64 * 1024; // 64 KB

export interface LayoutBlock {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

export interface PageConfig {
  size: 'A4' | 'LETTER';
  margin: number; // in points
}

export interface HybridLayout {
  page: PageConfig;
  blocks: LayoutBlock[];
}

export interface LayoutValidationError {
  blockId?: string;
  blockIndex?: number;
  field: string;
  message: string;
}

export interface LayoutValidationResult {
  valid: boolean;
  errors: LayoutValidationError[];
}

const ALLOWED_PAGE_SIZES: PageConfig['size'][] = ['A4', 'LETTER'];

// ─── Main Layout Validator ────────────────────────────────────────────────────

export function validateLayout(raw: unknown): LayoutValidationResult {
  const errors: LayoutValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Layout must be an object' }] };
  }

  const layout = raw as Record<string, unknown>;

  // Limit layout size
  const layoutBytes = JSON.stringify(layout).length;
  if (layoutBytes > MAX_LAYOUT_BYTES) {
    errors.push({ field: 'root', message: `Layout exceeds maximum size (${MAX_LAYOUT_BYTES} bytes)` });
  }

  // Page config
  if (!layout.page || typeof layout.page !== 'object') {
    errors.push({ field: 'page', message: 'page config is required' });
  } else {
    const page = layout.page as Record<string, unknown>;
    if (!ALLOWED_PAGE_SIZES.includes(page.size as PageConfig['size'])) {
      errors.push({ field: 'page.size', message: `page.size must be one of: ${ALLOWED_PAGE_SIZES.join(', ')}` });
    }
    if (page.margin !== undefined) {
      const m = Number(page.margin);
      if (isNaN(m) || m < 8 || m > 72) {
        errors.push({ field: 'page.margin', message: 'page.margin must be between 8 and 72' });
      }
    }
  }

  // Blocks array
  if (!Array.isArray(layout.blocks)) {
    errors.push({ field: 'blocks', message: 'blocks must be an array' });
    return { valid: errors.length === 0, errors };
  }

  if (layout.blocks.length > MAX_LAYOUT_BLOCKS) {
    errors.push({ field: 'blocks', message: `Layout exceeds maximum of ${MAX_LAYOUT_BLOCKS} blocks` });
  }

  // Check for unique block IDs
  const seenIds = new Set<string>();

  for (let i = 0; i < layout.blocks.length; i++) {
    const block = layout.blocks[i] as Record<string, unknown>;

    if (!block || typeof block !== 'object') {
      errors.push({ blockIndex: i, field: 'type', message: `Block ${i} is not an object` });
      continue;
    }

    // ID
    if (!block.id || typeof block.id !== 'string' || block.id.trim() === '') {
      errors.push({ blockIndex: i, field: 'id', message: `Block ${i}: id is required` });
    } else {
      const blockId = block.id as string;
      if (seenIds.has(blockId)) {
        errors.push({ blockIndex: i, blockId, field: 'id', message: `Duplicate block id: ${blockId}` });
      } else {
        seenIds.add(blockId);
      }
    }

    // Type
    if (!isValidBlockType(block.type)) {
      errors.push({
        blockIndex: i,
        blockId: block.id as string,
        field: 'type',
        message: `Block ${i}: unknown block type "${block.type}". Allowed: ${BLOCK_TYPES.join(', ')}`,
      });
      continue; // can't validate props without knowing the type
    }

    // Props must be explicitly present
    if (block.props === undefined || block.props === null || typeof block.props !== 'object' || Array.isArray(block.props)) {
      errors.push({
        blockIndex: i,
        blockId: block.id as string,
        field: `blocks[${i}].props`,
        message: `Block ${i}: props must be an object`,
      });
      continue;
    }

    const blockType = block.type as BlockType;
    const blockDef = BLOCK_REGISTRY[blockType];
    const props = (block.props ?? {}) as Record<string, unknown>;

    // Validate required props
    for (const required of blockDef.requiredProps) {
      const key = required as string;
      if (props[key] === undefined || props[key] === null || props[key] === '') {
        errors.push({
          blockIndex: i,
          blockId: block.id as string,
          field: `props.${key}`,
          message: `Block ${i} (${blockType}): required prop "${key}" is missing`,
        });
      }
    }

    // Validate prop schemas for provided props
    for (const [propKey, propValue] of Object.entries(props)) {
      const schema = blockDef.allowedPropsSchema[propKey];
      if (!schema) continue; // unknown props are tolerated but not validated

      const propErrors = validateProp(propKey, propValue, schema, i, block.id as string, blockType);
      errors.push(...propErrors);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Prop Validator ───────────────────────────────────────────────────────────

function validateProp(
  key: string,
  value: unknown,
  schema: PropSchema,
  blockIndex: number,
  blockId: string,
  blockType: BlockType,
): LayoutValidationError[] {
  const errors: LayoutValidationError[] = [];
  const context = { blockIndex, blockId, field: `props.${key}` };

  if (value === null || value === undefined) {
    if (schema.required) {
      errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" is required` });
    }
    return errors;
  }

  switch (schema.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be boolean` });
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be a string` });
      }
      break;

    case 'number': {
      const num = typeof value === 'number' ? value : Number(value);
      if (isNaN(num)) {
        errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be a number` });
      } else {
        if (schema.min !== undefined && num < schema.min) {
          errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be >= ${schema.min}` });
        }
        if (schema.max !== undefined && num > schema.max) {
          errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be <= ${schema.max}` });
        }
      }
      break;
    }

    case 'enum': {
      const strVal = String(value);
      if (schema.enumValues && !schema.enumValues.includes(strVal)) {
        errors.push({ ...context, message: `Block ${blockIndex} (${blockType}): "${key}" must be one of: ${schema.enumValues.join(', ')}` });
      }
      break;
    }
  }

  return errors;
}

// ─── Security: reject dangerous content ──────────────────────────────────────

const DANGEROUS_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i, /data:text\/html/i];

export function sanitizeLayoutSecurity(raw: unknown): { safe: boolean; reason?: string } {
  const json = JSON.stringify(raw ?? '');
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(json)) {
      const match = json.match(pattern)?.[0] ?? 'unsafe content';
      return { safe: false, reason: `Potentially unsafe content detected in layout JSON: ${match}` };
    }
  }
  return { safe: true };
}
