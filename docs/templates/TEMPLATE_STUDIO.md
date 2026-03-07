# Template Studio

Template Studio is the Admin back-office interface for managing tenant print templates. It is a **structured configuration editor**, not a freeform page designer.

## What Template Studio Is

Template Studio lets admin users:
- View all templates for their tenant
- Create templates from blueprints, by cloning, or from a family shell
- Edit structured layout/display options (labels, section visibility, footer config)
- Preview templates using sample data
- Activate, archive, and create new versions of templates
- Map templates to catalog tests with schema validation

## What Template Studio Is NOT

- It is **not** a drag-and-drop canvas
- It is **not** an HTML/CSS editor
- It is **not** an arbitrary PDF builder
- It is **not** accessible to operator users (admin-only)
- It does **not** trigger live document publishing or workflow state changes

## Admin Routes

| Route | Purpose |
|-------|---------|
| `/templates` | Templates list |
| `/templates/new` | Create wizard |
| `/templates/{id}` | Template editor |
| `/templates/{id}/preview` | Preview PDF |

Templates list and editor are under the `(protected)` route group in the Admin app.

## Templates List

Shows all tenant templates with:
- Name, code, family, schema type, version, status, source
- Filter by status and family
- Actions: open editor, preview, clone, archive

## Create Template Wizard

Step 1 — Choose source:
- **From Blueprint**: Copies a system blueprint into tenant space. Recommended for first setup.
- **Clone Existing**: Copies an existing tenant template. Useful for making variants.
- **From Family Shell**: Creates a minimal empty template for a given family and schema type.

Step 2 — Configure:
- Template name, code
- Select source (blueprint/template) or select family+schema for shell
- System validates family/schema compatibility before submission

## Template Editor

The editor presents structured sections for editable fields only.

### Read-only fields (cannot change after creation)
- Template family
- Schema type
- Code (derived from creation)
- Version number (incremented by system)

### Editable fields
| Section | Fields |
|---------|--------|
| Metadata | Name |
| Header Options | Show logo, show brand name, show report header |
| Demographics Block | Show MRN, show age, show gender, show DOB |
| Results Block | Show reference range, show flag, show unit |
| Footer Options | Show disclaimer, show signature, show verified-by |

All options are stored in `configJson` and passed to the PDF renderer.

### Action buttons
| Action | Available When | Behavior |
|--------|----------------|----------|
| Save Changes | DRAFT | Saves edits in-place |
| Save as New Draft | ACTIVE | Creates a new DRAFT version; active version stays live |
| Activate | DRAFT | Promotes DRAFT to ACTIVE; archives previous ACTIVE with same code |
| Archive | ACTIVE or DRAFT | Archives the template; blocked if it's a default for any test |
| New Version | ACTIVE | Creates a new DRAFT derived from current ACTIVE |
| Preview | Any non-archived | Generates a sample PDF in the browser |

All destructive actions (activate, archive) require confirmation.

## Preview Flow

Preview renders a sample PDF using sample data without creating any real documents or changing workflow state.

- Calls `POST /admin/templates/{id}/preview`
- PDF is streamed back as binary
- Admin app creates a blob URL and renders it in an iframe
- Preview can be downloaded via the Download PDF link

**Preview is admin tooling only.** Live publishing remains in the normal document pipeline.

## Test Template Mapping

In the Catalog section (test detail page), admin can:
- See the test's `resultSchemaType`
- See all mapped templates
- Set which template is the default
- Toggle `allowTemplateOverride`
- Add/remove mappings (with schema compatibility enforced)

Mapping uses `PUT /admin/catalog/tests/{testId}/templates`. The system rejects mappings where the template's `schemaType` does not match the test's `resultSchemaType`.

## Permissions Required

| Permission | What it allows |
|------------|----------------|
| `templates.read` | View templates, blueprints, mappings, preview |
| `templates.write` | Create, edit, clone, version, activate, archive, map |
| `templates.provision` | Provision blueprints into tenant templates |

Operator and verifier roles have no template permissions.
