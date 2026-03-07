'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType =
  | 'HEADER'
  | 'DEMOGRAPHICS'
  | 'PARAMETER_TABLE'
  | 'NARRATIVE_SECTION'
  | 'GRAPH_SCALE'
  | 'IMAGE_GRID'
  | 'SIGNATURE_BLOCK'
  | 'DISCLAIMER'
  | 'SPACER'
  | 'SECTION_TITLE';

interface LayoutBlock {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

interface HybridLayout {
  page: { size: string; margin: number };
  blocks: LayoutBlock[];
}

// ─── Block Library Definition ─────────────────────────────────────────────────

interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  defaultProps: Record<string, unknown>;
}

const BLOCK_LIBRARY: BlockDef[] = [
  { type: 'HEADER',          label: 'Header',          icon: '🏷️',  description: 'Report header with logo and title', defaultProps: { showLogo: true, title: '', alignment: 'left' } },
  { type: 'DEMOGRAPHICS',    label: 'Demographics',    icon: '👤',  description: 'Patient and encounter info', defaultProps: { columns: 2 } },
  { type: 'PARAMETER_TABLE', label: 'Parameter Table', icon: '📊',  description: 'Test results table', defaultProps: { source: 'test.parameters', showUnits: true, showReferenceRange: true, showFlag: true } },
  { type: 'NARRATIVE_SECTION',label: 'Narrative Section',icon: '📝',description: 'Free-text narrative field', defaultProps: { title: 'Impression', field: 'interpretation' } },
  { type: 'GRAPH_SCALE',     label: 'Graph Scale',     icon: '📈',  description: 'Visual scale band chart', defaultProps: { parameterConfigKey: '' } },
  { type: 'IMAGE_GRID',      label: 'Image Grid',      icon: '🖼️',  description: 'Grid of attached images', defaultProps: { columns: 2, maxImages: 6 } },
  { type: 'SIGNATURE_BLOCK', label: 'Signature',       icon: '✍️',  description: 'Signature line', defaultProps: { label: 'Authorized By', showDate: true, showStamp: false } },
  { type: 'DISCLAIMER',      label: 'Disclaimer',      icon: '⚠️',  description: 'Disclaimer or notice text', defaultProps: { text: '' } },
  { type: 'SPACER',          label: 'Spacer',          icon: '↕️',  description: 'Vertical spacing', defaultProps: { height: 12 } },
  { type: 'SECTION_TITLE',   label: 'Section Title',   icon: '🔤',  description: 'Bold section heading', defaultProps: { text: 'Section', fontSize: 10, underline: true } },
];

const BLOCK_DEF_MAP = Object.fromEntries(BLOCK_LIBRARY.map(d => [d.type, d])) as Record<BlockType, BlockDef>;

// ─── Sortable Block Item ──────────────────────────────────────────────────────

function SortableBlockItem({
  block,
  isSelected,
  onSelect,
  onRemove,
}: {
  block: LayoutBlock;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const def = BLOCK_DEF_MAP[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer select-none transition-colors
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        ⠿
      </span>
      <span>{def?.icon ?? '📦'}</span>
      <span className="text-sm font-medium text-gray-700 flex-1">{def?.label ?? block.type}</span>
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="text-red-400 hover:text-red-600 text-xs px-1"
        title="Remove block"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  block,
  onChange,
}: {
  block: LayoutBlock | null;
  onChange: (blockId: string, props: Record<string, unknown>) => void;
}) {
  if (!block) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a block to configure its properties
      </div>
    );
  }

  const def = BLOCK_DEF_MAP[block.type];
  const props = block.props;

  const set = (key: string, value: unknown) => onChange(block.id, { ...props, [key]: value });
  const setBool = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.checked);
  const setStr  = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value);
  const setNum  = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, Number(e.target.value));

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );

  const TextInput = ({ k, placeholder = '' }: { k: string; placeholder?: string }) => (
    <input
      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
      value={String(props[k] ?? '')}
      placeholder={placeholder}
      onChange={setStr(k)}
    />
  );

  const CheckInput = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={Boolean(props[k])} onChange={setBool(k)} />
      {label}
    </label>
  );

  const NumberInput = ({ k, min = 0, max = 200 }: { k: string; min?: number; max?: number }) => (
    <input
      type="number"
      min={min}
      max={max}
      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
      value={Number(props[k] ?? 0)}
      onChange={setNum(k)}
    />
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{def?.icon ?? '📦'}</span>
        <div>
          <div className="font-semibold text-gray-800">{def?.label ?? block.type}</div>
          <div className="text-xs text-gray-500">{def?.description}</div>
        </div>
      </div>

      {block.type === 'HEADER' && (
        <>
          <Field label="Title (leave blank to use brand name)"><TextInput k="title" placeholder="e.g. Lab Report" /></Field>
          <Field label="Alignment">
            <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={String(props.alignment ?? 'left')} onChange={setStr('alignment')}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
          <Field label="Options"><CheckInput k="showLogo" label="Show logo" /></Field>
        </>
      )}

      {block.type === 'DEMOGRAPHICS' && (
        <Field label="Columns">
          <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={String(props.columns ?? 2)} onChange={setStr('columns')}>
            <option value="1">1 column</option>
            <option value="2">2 columns</option>
          </select>
        </Field>
      )}

      {block.type === 'PARAMETER_TABLE' && (
        <>
          <Field label="Options">
            <div className="space-y-1">
              <CheckInput k="showUnits"         label="Show units" />
              <CheckInput k="showReferenceRange" label="Show reference range" />
              <CheckInput k="showFlag"          label="Show flag" />
            </div>
          </Field>
        </>
      )}

      {block.type === 'NARRATIVE_SECTION' && (
        <>
          <Field label="Section Title"><TextInput k="title" placeholder="Impression" /></Field>
          <Field label="Data Field (payload key)"><TextInput k="field" placeholder="interpretation" /></Field>
        </>
      )}

      {block.type === 'GRAPH_SCALE' && (
        <Field label="Parameter Config Key"><TextInput k="parameterConfigKey" placeholder="e.g. total_cholesterol" /></Field>
      )}

      {block.type === 'IMAGE_GRID' && (
        <>
          <Field label="Columns"><NumberInput k="columns" min={1} max={4} /></Field>
          <Field label="Max Images"><NumberInput k="maxImages" min={1} max={20} /></Field>
        </>
      )}

      {block.type === 'SIGNATURE_BLOCK' && (
        <>
          <Field label="Label"><TextInput k="label" placeholder="Authorized By" /></Field>
          <Field label="Options">
            <div className="space-y-1">
              <CheckInput k="showDate"  label="Show date line" />
              <CheckInput k="showStamp" label="Show stamp placeholder" />
            </div>
          </Field>
        </>
      )}

      {block.type === 'DISCLAIMER' && (
        <Field label="Disclaimer Text (leave blank to use branding footer)">
          <textarea
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            rows={3}
            value={String(props.text ?? '')}
            onChange={setStr('text')}
            placeholder="Disclaimer text..."
          />
        </Field>
      )}

      {block.type === 'SPACER' && (
        <Field label="Height (px)"><NumberInput k="height" min={4} max={120} /></Field>
      )}

      {block.type === 'SECTION_TITLE' && (
        <>
          <Field label="Text"><TextInput k="text" placeholder="Section Heading" /></Field>
          <Field label="Font Size"><NumberInput k="fontSize" min={8} max={20} /></Field>
          <Field label="Options"><CheckInput k="underline" label="Show underline" /></Field>
        </>
      )}

      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-400">
        Block ID: {block.id}
      </div>
    </div>
  );
}

// ─── Main Studio Page ─────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TemplatestudioPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params?.id as string;

  const [template,      setTemplate]      = useState<any>(null);
  const [layout,        setLayout]        = useState<HybridLayout>({ page: { size: 'A4', margin: 24 }, blocks: [] });
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dragActiveId,  setDragActiveId]  = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [previewing,    setPreviewing]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load template + existing layout
  useEffect(() => {
    if (!id) return;
    const token = getToken();
    const api   = getApiClient(token ?? '');

    (api as any).getTemplate(id).then((res: any) => {
      setTemplate(res.data ?? res);
    }).catch(() => setError('Failed to load template'));

    (api as any).getTemplateLayout(id).then((res: any) => {
      const data = res.data ?? res;
      if (data?.blocks) setLayout(data);
    }).catch(() => { /* no layout yet — keep empty default */ });
  }, [id]);

  const selectedBlock = layout.blocks.find(b => b.id === selectedId) ?? null;

  // Drag end within canvas (reorder)
  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.blocks.findIndex(b => b.id === active.id);
    const newIndex = layout.blocks.findIndex(b => b.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setLayout(l => ({ ...l, blocks: arrayMove(l.blocks, oldIndex, newIndex) }));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(String(event.active.id));
  };

  // Add block from library
  const addBlock = (def: BlockDef) => {
    const newBlock: LayoutBlock = {
      id:    `${def.type.toLowerCase()}_${generateId()}`,
      type:  def.type,
      props: { ...def.defaultProps },
    };
    setLayout(l => ({ ...l, blocks: [...l.blocks, newBlock] }));
    setSelectedId(newBlock.id);
  };

  // Remove block
  const removeBlock = (blockId: string) => {
    setLayout(l => ({ ...l, blocks: l.blocks.filter(b => b.id !== blockId) }));
    if (selectedId === blockId) setSelectedId(null);
  };

  // Update block props
  const updateBlockProps = useCallback((blockId: string, props: Record<string, unknown>) => {
    setLayout(l => ({
      ...l,
      blocks: l.blocks.map(b => b.id === blockId ? { ...b, props } : b),
    }));
  }, []);

  // Save draft
  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = getToken();
      const api   = getApiClient(token ?? '');
      await (api as any).saveTemplateLayout(id, layout);
      setSuccessMsg('Layout saved as draft');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      const detail = e?.response?.data?.message ?? 'Save failed';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSaving(false);
    }
  };

  // Preview
  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      // First save so preview uses current layout
      const token = getToken();
      const api   = getApiClient(token ?? '');
      await (api as any).saveTemplateLayout(id, layout);

      // Open preview in new tab
      const previewUrl = `/admin/templates/${id}/preview`;
      window.open(previewUrl, '_blank');
    } catch (e: any) {
      setError('Preview failed — try saving first');
    } finally {
      setPreviewing(false);
    }
  };

  // Activate
  const handleActivate = async () => {
    if (!confirm('Activate this template? Existing active version will be superseded.')) return;
    try {
      const token = getToken();
      const api   = getApiClient(token ?? '');
      await (api as any).saveTemplateLayout(id, layout);
      await (api as any).activatePrintTemplate(id);
      setSuccessMsg('Template activated');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Activation failed');
    }
  };

  const dragOverlayBlock = dragActiveId ? layout.blocks.find(b => b.id === dragActiveId) : null;
  const pageMargin = layout.page?.margin ?? 24;

  if (error && !template) {
    return (
      <div className="p-8">
        <div className="text-red-600 mb-4">{error}</div>
        <Link href="/templates" className="text-blue-600 underline">← Back to Templates</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <Link href={`/templates/${id}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back
        </Link>
        <div className="flex-1">
          <span className="font-semibold text-gray-800">Template Studio</span>
          {template && (
            <span className="ml-2 text-sm text-gray-500">
              — {template.name} (v{template.templateVersion})
              {template.status === 'ACTIVE' && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">ACTIVE</span>
              )}
              {template.status === 'DRAFT' && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">DRAFT</span>
              )}
            </span>
          )}
        </div>

        {/* Page config */}
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">Margin:</label>
          <input
            type="number"
            min={8}
            max={72}
            value={pageMargin}
            onChange={e => setLayout(l => ({ ...l, page: { ...l.page, margin: Number(e.target.value) } }))}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <span className="text-gray-400">px</span>
        </div>

        <button
          onClick={saveDraft}
          disabled={saving}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium"
        >
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={handlePreview}
          disabled={previewing}
          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm font-medium"
        >
          {previewing ? 'Preparing…' : 'Preview'}
        </button>
        <button
          onClick={handleActivate}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
        >
          Activate
        </button>
      </div>

      {/* Notifications */}
      {(error || successMsg) && (
        <div className={`px-4 py-2 text-sm flex-shrink-0 ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {error ?? successMsg}
          {error && <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>}
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Block Library */}
        <div className="w-56 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Block Library
          </div>
          <div className="p-2 space-y-1">
            {BLOCK_LIBRARY.map(def => (
              <button
                key={def.type}
                onClick={() => addBlock(def)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-50 hover:text-blue-700 text-sm transition-colors"
                title={def.description}
              >
                <span>{def.icon}</span>
                <span className="font-medium">{def.label}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
            Click to add a block to the canvas
          </div>
        </div>

        {/* CENTER — Canvas */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-xl mx-auto">
            {layout.blocks.length === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">📄</div>
                <div className="font-medium">Empty Layout</div>
                <div className="text-sm mt-1">Click blocks in the library to add them here</div>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={layout.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {layout.blocks.map(block => (
                    <SortableBlockItem
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {dragOverlayBlock && (
                  <div className="px-3 py-2 bg-white border border-blue-400 rounded shadow-lg text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>{BLOCK_DEF_MAP[dragOverlayBlock.type]?.icon}</span>
                    <span>{BLOCK_DEF_MAP[dragOverlayBlock.type]?.label}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {layout.blocks.length > 0 && (
              <div className="mt-4 text-xs text-gray-400 text-center">
                {layout.blocks.length} block{layout.blocks.length !== 1 ? 's' : ''} — drag to reorder
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Properties */}
        <div className="w-72 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Properties
          </div>
          <PropertiesPanel block={selectedBlock} onChange={updateBlockProps} />
        </div>

      </div>
    </div>
  );
}
