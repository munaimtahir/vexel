# Template Studio — Visual Block Layout Designer

## Overview

Template Studio is a drag-and-drop block composition tool in the Admin app that allows administrators to design report layouts using predefined blocks. Layouts are stored as deterministic JSON and interpreted by the `HYBRID_TEMPLATE` renderer via QuestPDF.

## Architecture

```
Template Studio UI (Admin — /admin/templates/studio/:id)
      │
      ▼
HybridLayoutConfig JSON (stored in PrintTemplate.configJson)
      │
      ▼
HYBRID_TEMPLATE renderer (pdf service: hybrid_template_v1)
      │
      ▼
QuestPDF — deterministic PDF output
```

Template Studio does **not** produce HTML or SVG. All layout information is structured JSON interpreted server-side by the PDF renderer.

## Accessing Template Studio

1. Navigate to **Admin → Templates**
2. Open a template with family `HYBRID_TEMPLATE`
3. Click **Open Template Studio**
4. Alternatively, navigate directly to `/admin/templates/studio/:templateId`

## Layout JSON Schema

Templates store a `HybridLayoutConfig` in their `configJson` field:

```json
{
  "page": {
    "size": "A4",
    "margin": 24
  },
  "blocks": [
    {
      "id": "header1",
      "type": "HEADER",
      "props": {
        "showLogo": true,
        "title": "Lab Report"
      }
    },
    {
      "id": "demo1",
      "type": "DEMOGRAPHICS",
      "props": {
        "columns": 2
      }
    }
  ]
}
```

### Constraints

| Constraint | Limit |
|---|---|
| Max blocks per layout | 50 |
| Max layout JSON size | 64 KB |
| Block IDs | Must be unique within layout |
| Block types | Must be from the closed `BlockType` enum |
| Nesting | Not supported — flat vertical flow only |

## Block Types

| Type | Icon | Description |
|---|---|---|
| `HEADER` | 🏷️ | Report header with optional logo and title |
| `DEMOGRAPHICS` | 👤 | Patient name, MRN, DOB, gender, encounter info |
| `PARAMETER_TABLE` | 📊 | Test results in a formatted table |
| `NARRATIVE_SECTION` | 📝 | Free-text narrative field from payload |
| `GRAPH_SCALE` | 📈 | Visual interpretation scale (references graphical config) |
| `IMAGE_GRID` | 🖼️ | Grid of attached images (rendering deferred — placeholder in v1) |
| `SIGNATURE_BLOCK` | ✍️ | Authorized-by signature line with optional date |
| `DISCLAIMER` | ⚠️ | Footer disclaimer / notice text |
| `SPACER` | ↕️ | Vertical whitespace |
| `SECTION_TITLE` | 🔤 | Bold section heading |

## Block Props Reference

### HEADER

| Prop | Type | Default | Description |
|---|---|---|---|
| `showLogo` | boolean | `true` | Display tenant logo if available |
| `title` | string | `""` | Override title (empty = use brand name) |
| `alignment` | `"left"` \| `"center"` \| `"right"` | `"left"` | Header text alignment |

### DEMOGRAPHICS

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `1` \| `2` | `2` | Number of columns |

### PARAMETER_TABLE

| Prop | Type | Default | Description |
|---|---|---|---|
| `source` | string | `"test.parameters"` | Data source path |
| `showUnits` | boolean | `true` | Show unit column |
| `showReferenceRange` | boolean | `true` | Show reference range column |
| `showFlag` | boolean | `true` | Show flag column |

### NARRATIVE_SECTION

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | string | `"Impression"` | Section heading |
| `field` | string | `"interpretation"` | Payload key to read text from |

### GRAPH_SCALE

| Prop | Type | Default | Description |
|---|---|---|---|
| `parameterConfigKey` | string | `""` | Key referencing a parameter config |

> Note: GRAPH_SCALE block inside HYBRID_TEMPLATE renders as a placeholder in this phase. Use the `GRAPHICAL_SCALE_REPORT` template family for full visual scale rendering.

### IMAGE_GRID

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | number | `2` | Columns in the image grid |
| `maxImages` | number | `6` | Maximum images to render |

> Note: IMAGE_GRID renders as a placeholder in this phase (requires MinIO asset fetching).

### SIGNATURE_BLOCK

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | string | `"Authorized By"` | Signature line label |
| `showDate` | boolean | `true` | Include date line |
| `showStamp` | boolean | `false` | Include stamp placeholder |

### DISCLAIMER

| Prop | Type | Default | Description |
|---|---|---|---|
| `text` | string | `""` | Disclaimer text (empty = use branding footer) |

### SPACER

| Prop | Type | Default | Description |
|---|---|---|---|
| `height` | number (px) | `12` | Height in points |

### SECTION_TITLE

| Prop | Type | Default | Description |
|---|---|---|---|
| `text` | string | `"Section"` | Heading text |
| `fontSize` | number | `10` | Font size in pt |
| `underline` | boolean | `true` | Show underline |

## Using the Studio

### Adding Blocks

Click any block in the **Block Library** panel (left). The block is added to the bottom of the canvas.

### Reordering Blocks

Drag blocks by the `⠿` handle on the left side of each block row. Drop them in the desired position.

### Configuring Blocks

Click a block to select it. The **Properties** panel (right) shows editable fields specific to the block type.

### Saving

Click **Save Draft** to save the current layout. If the template is `ACTIVE`, a new `DRAFT` version is created automatically (per versioning rules).

### Previewing

Click **Preview** to save the current layout and open a PDF preview in a new tab using sample data.

### Activating

Click **Activate** to activate the template. This archives any other active version with the same code.

## Validation Rules

Layout JSON is validated before saving:

- `page` object must be present
- `page.margin` must be between 8 and 72
- `blocks` must be an array
- `blocks` must not exceed 50 items
- Each block must have a non-empty unique `id`
- Each block `type` must be a valid `BlockType`
- Each block must have a `props` object

Security checks reject:

- `<script>` tags anywhere in JSON values
- `javascript:` URI schemes
- Inline event handler strings (`onclick=`, `onerror=`, etc.)

## PDF Rendering

The `hybrid_template_v1` renderer in the PDF service iterates blocks sequentially:

```
for block in layout.blocks:
  switch(block.type)
    HEADER           → renderHeader()
    DEMOGRAPHICS     → renderDemographics()
    PARAMETER_TABLE  → renderParameterTable()
    NARRATIVE_SECTION→ renderNarrative()
    GRAPH_SCALE      → renderGraphScale() [placeholder]
    IMAGE_GRID       → renderImageGrid() [placeholder]
    SIGNATURE_BLOCK  → renderSignature()
    DISCLAIMER       → renderDisclaimer()
    SPACER           → renderSpacer()
    SECTION_TITLE    → renderSectionTitle()
```

Unknown block types are silently skipped (future-safe).

## Adding New Block Types

1. Add the type to `BLOCK_TYPES` in `apps/api/src/templates/blocks/block-registry.ts`
2. Add the `BlockDefinition` entry to `BLOCK_REGISTRY`
3. Add the prop schema validation in `block-registry.ts`
4. Add a `case` in the PDF renderer `HybridTemplateDocument.RenderBlock()` switch
5. Add the block to `BLOCK_LIBRARY` in the Studio UI page
6. Update the `BlockType` enum in `packages/contracts/openapi.yaml` and regen SDK

## Versioning

Layout saves follow the same versioning rules as all templates:

- Saving a `DRAFT` template → updates in-place
- Saving an `ACTIVE` template → creates a new `DRAFT` version
- Historical documents always reference the template version they were generated with

## Limitations (This Phase)

- `GRAPH_SCALE` block inside HYBRID_TEMPLATE renders as a placeholder — full integration deferred
- `IMAGE_GRID` block renders as a placeholder — requires MinIO asset fetching in renderer
- No absolute positioning — layouts are vertical flow only
- No conditional blocks (show/hide based on data)
- No column split within a block (except DEMOGRAPHICS which has a 2-column mode)

## Non-Goals

- Drag-and-drop precise positioning (not a page designer — vertical flow only)
- Arbitrary HTML injection
- Tenant-created custom block types
- AI-generated layout suggestions
