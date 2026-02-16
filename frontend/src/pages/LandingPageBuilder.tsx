import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  Image,
  MousePointerClick,
  FileInput,
  GripVertical,
  Settings,
  Globe,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Modal, Loading, Badge } from '@/components/common';
import { pagesAPI, getErrorMessage } from '@/services/api';
import toast from 'react-hot-toast';
import type {
  LandingPage,
  LandingPageBlock,
  LandingBlockType,
} from '@/types';

// =============================================================================
// BLOCK PALETTE DEFINITIONS
// =============================================================================

interface BlockPaletteItem {
  type: LandingBlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultContent: Record<string, unknown>;
}

const BLOCK_PALETTE: BlockPaletteItem[] = [
  {
    type: 'hero',
    label: 'Hero',
    icon: <Type className="w-5 h-5" />,
    description: 'Heading, subheading, and CTA',
    defaultContent: {
      heading: 'Your Headline Here',
      subheading: 'A compelling subheading that describes your offer.',
      cta_text: 'Get Started',
      cta_url: '#',
      background_color: '#4F46E5',
      background_image: '',
    },
  },
  {
    type: 'text',
    label: 'Text',
    icon: <AlignLeft className="w-5 h-5" />,
    description: 'Rich text content block',
    defaultContent: {
      heading: 'Section Heading',
      body: 'Write your content here. You can describe your product, service, or any information you want to share with your visitors.',
    },
  },
  {
    type: 'image',
    label: 'Image',
    icon: <Image className="w-5 h-5" />,
    description: 'Image with caption',
    defaultContent: {
      url: '',
      alt: 'Image description',
      caption: '',
    },
  },
  {
    type: 'cta',
    label: 'CTA',
    icon: <MousePointerClick className="w-5 h-5" />,
    description: 'Call-to-action section',
    defaultContent: {
      heading: 'Ready to get started?',
      description: 'Take action now and see the difference.',
      button_text: 'Sign Up Now',
      button_url: '#',
    },
  },
  {
    type: 'form',
    label: 'Form',
    icon: <FileInput className="w-5 h-5" />,
    description: 'Configurable form fields',
    defaultContent: {
      heading: 'Contact Us',
      fields: [
        { label: 'Name', name: 'name', type: 'text', required: true, placeholder: 'Your name', options: [] },
        { label: 'Email', name: 'email', type: 'email', required: true, placeholder: 'you@example.com', options: [] },
        { label: 'Message', name: 'message', type: 'textarea', required: false, placeholder: 'Your message...', options: [] },
      ],
      submit_text: 'Submit',
      success_message: 'Thank you! Your submission has been received.',
    },
  },
];

// =============================================================================
// FORM FIELD TYPE
// =============================================================================

interface FormField {
  label: string;
  name: string;
  type: 'text' | 'email' | 'textarea' | 'select';
  required: boolean;
  placeholder: string;
  options?: string[];
}

// =============================================================================
// BLOCK ICON HELPER
// =============================================================================

function getBlockIcon(type: LandingBlockType) {
  const item = BLOCK_PALETTE.find((b) => b.type === type);
  return item?.icon ?? <Type className="w-4 h-4" />;
}

function getBlockLabel(type: LandingBlockType) {
  const item = BLOCK_PALETTE.find((b) => b.type === type);
  return item?.label ?? type;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LandingPageBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEditMode = !!id;

  // Page-level state
  const [title, setTitle] = useState('Untitled Page');
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // Block state
  const [blocks, setBlocks] = useState<LandingPageBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Mobile sidebar visibility
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialLoadDone = useRef(false);

  // Auto-slug tracking
  const slugManuallyEdited = useRef(false);

  // =========================================================================
  // FETCH EXISTING PAGE DATA
  // =========================================================================

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['landingPage', id],
    queryFn: () => pagesAPI.get(id!),
    enabled: isEditMode,
  });

  // Sync fetched data to local state (React Query v5 pattern)
  useEffect(() => {
    if (!pageData) return;
    setTitle(pageData.title);
    setSlug(pageData.slug);
    setSeoTitle(pageData.seo_title || '');
    setSeoDescription(pageData.seo_description || '');
    setOgImageUrl(pageData.og_image_url || '');
    setIsPublished(pageData.is_published);
    setBlocks(pageData.blocks || []);
    // Mark initial load as done after a tick so the change tracker skips this sync
    requestAnimationFrame(() => {
      initialLoadDone.current = true;
      setHasUnsavedChanges(false);
    });
  }, [pageData]);

  // Auto-generate slug from title in create mode
  useEffect(() => {
    if (isEditMode || slugManuallyEdited.current) return;
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);
    setSlug(generated);
  }, [title, isEditMode]);

  // Track unsaved changes
  useEffect(() => {
    if (!initialLoadDone.current && isEditMode) return;
    setHasUnsavedChanges(true);
  }, [title, slug, blocks, seoTitle, seoDescription, ogImageUrl, isEditMode]);

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof pagesAPI.create>[0]) => pagesAPI.create(data),
    onSuccess: (created: LandingPage) => {
      toast.success('Landing page created!');
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      navigate(`/dashboard/pages/${created.id}/edit`, { replace: true });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof pagesAPI.update>[1]) => pagesAPI.update(id!, data),
    onSuccess: () => {
      toast.success('Landing page saved!');
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['landingPage', id] });
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const publishMutation = useMutation({
    mutationFn: (publish: boolean) =>
      pagesAPI.update(id!, { is_published: publish }),
    onSuccess: (_: LandingPage, publish: boolean) => {
      setIsPublished(publish);
      toast.success(publish ? 'Page published!' : 'Page unpublished');
      queryClient.invalidateQueries({ queryKey: ['landingPage', id] });
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err));
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // =========================================================================
  // BLOCK OPERATIONS
  // =========================================================================

  const addBlock = useCallback(
    (type: LandingBlockType) => {
      const palette = BLOCK_PALETTE.find((b) => b.type === type);
      if (!palette) return;

      const newBlock: LandingPageBlock = {
        id: crypto.randomUUID(),
        type,
        content: { ...palette.defaultContent },
        settings: {},
      };

      setBlocks((prev) => [...prev, newBlock]);
      setSelectedBlockId(newBlock.id);

      // On mobile, show right sidebar when block is added
      setShowRightSidebar(true);
      setShowLeftSidebar(false);
    },
    []
  );

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setSelectedBlockId((current) => (current === blockId ? null : current));
  }, []);

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const next = [...prev];
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const duplicateBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copy: LandingPageBlock = {
        id: crypto.randomUUID(),
        type: original.type,
        content: JSON.parse(JSON.stringify(original.content)),
        settings: JSON.parse(JSON.stringify(original.settings || {})),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const updateBlockContent = useCallback(
    (blockId: string, key: string, value: unknown) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, content: { ...b.content, [key]: value } }
            : b
        )
      );
    },
    []
  );

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  // =========================================================================
  // SAVE HANDLER
  // =========================================================================

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      toast.error('Page title is required');
      return;
    }
    if (!slug.trim()) {
      toast.error('Page slug is required');
      return;
    }
    if (isPublished && blocks.length === 0) {
      toast.error('Add at least one block before publishing');
      return;
    }

    if (isEditMode) {
      updateMutation.mutate({
        title,
        slug,
        blocks,
        settings: {},
        seo_title: seoTitle || undefined,
        seo_description: seoDescription || undefined,
        og_image_url: ogImageUrl || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        slug,
        blocks,
        settings: {},
        seo_title: seoTitle || undefined,
        seo_description: seoDescription || undefined,
      });
    }
  }, [
    title,
    slug,
    blocks,
    seoTitle,
    seoDescription,
    ogImageUrl,
    isPublished,
    isEditMode,
    updateMutation,
    createMutation,
  ]);

  // =========================================================================
  // LOADING STATE
  // =========================================================================

  if (isEditMode && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" />
      </div>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col bg-gray-100">
      {/* ================================================================= */}
      {/* TOP TOOLBAR                                                       */}
      {/* ================================================================= */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 z-20">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard/pages')}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Back to pages"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 truncate max-w-[200px] sm:max-w-xs"
            placeholder="Page title"
          />
          {slug && (
            <span className="text-sm text-gray-400 hidden sm:inline truncate">
              /p/{slug}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
              Unsaved
            </span>
          )}
        </div>

        {/* Mobile sidebar toggles */}
        <button
          onClick={() => { setShowLeftSidebar(!showLeftSidebar); setShowRightSidebar(false); }}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle block palette"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setShowRightSidebar(!showRightSidebar); setShowLeftSidebar(false); }}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Preview */}
        {isEditMode && pageData?.public_url && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Eye className="w-4 h-4" />}
            onClick={() => setShowPreview(true)}
          >
            <span className="hidden sm:inline">Preview</span>
          </Button>
        )}

        {/* Publish toggle */}
        {isEditMode && (
          <button
            onClick={() => publishMutation.mutate(!isPublished)}
            disabled={publishMutation.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isPublished
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPublished ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            {isPublished ? 'Published' : 'Draft'}
          </button>
        )}

        {/* Save */}
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="w-4 h-4" />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save
        </Button>
      </header>

      {/* ================================================================= */}
      {/* THREE-COLUMN LAYOUT                                               */}
      {/* ================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ----- LEFT SIDEBAR: Block Palette ----- */}
        <aside
          className={`
            flex-shrink-0 w-[250px] bg-white border-r border-gray-200 overflow-y-auto
            ${showLeftSidebar ? 'absolute inset-y-0 left-0 z-10 shadow-lg' : 'hidden'}
            lg:static lg:block lg:shadow-none
          `}
        >
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Add Block
            </h2>
            <div className="space-y-2">
              {BLOCK_PALETTE.map((item) => (
                <button
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-primary">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ----- CENTER CANVAS ----- */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-6"
          onClick={() => {
            setSelectedBlockId(null);
            setShowLeftSidebar(false);
            setShowRightSidebar(false);
          }}
        >
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-600">
                Start building your page
              </p>
              <p className="text-sm mt-1 text-gray-400 max-w-xs">
                Add blocks to create your landing page. Pick a block type below or from the sidebar.
              </p>
              <div className="flex items-center gap-3 mt-6">
                {BLOCK_PALETTE.slice(0, 3).map((item) => (
                  <button
                    key={item.type}
                    onClick={(e) => {
                      e.stopPropagation();
                      addBlock(item.type);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors shadow-sm"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {blocks.map((block, idx) => (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(block.id);
                    setShowRightSidebar(true);
                    setShowLeftSidebar(false);
                  }}
                  className={`relative group rounded-lg border-2 bg-white transition-colors cursor-pointer ${
                    selectedBlockId === block.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Block toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-2 text-gray-500">
                      <GripVertical className="w-4 h-4" />
                      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                        {getBlockIcon(block.type)}
                        {getBlockLabel(block.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlock(block.id, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlock(block.id, 'down');
                        }}
                        disabled={idx === blocks.length - 1}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateBlock(block.id);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                        aria-label="Duplicate block"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.id);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                        aria-label="Delete block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Block preview content */}
                  <div className="p-4">
                    <BlockPreview block={block} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ----- RIGHT SIDEBAR: Settings ----- */}
        <aside
          className={`
            flex-shrink-0 w-[300px] bg-white border-l border-gray-200 overflow-y-auto
            ${showRightSidebar ? 'absolute inset-y-0 right-0 z-10 shadow-lg' : 'hidden'}
            lg:static lg:block lg:shadow-none
          `}
        >
          <div className="p-4">
            {selectedBlock ? (
              <BlockSettings
                block={selectedBlock}
                onUpdateContent={updateBlockContent}
              />
            ) : (
              <PageSettings
                title={title}
                slug={slug}
                seoTitle={seoTitle}
                seoDescription={seoDescription}
                ogImageUrl={ogImageUrl}
                onTitleChange={setTitle}
                onSlugChange={(v: string) => { slugManuallyEdited.current = true; setSlug(v); }}
                onSeoTitleChange={setSeoTitle}
                onSeoDescriptionChange={setSeoDescription}
                onOgImageUrlChange={setOgImageUrl}
              />
            )}
          </div>
        </aside>
      </div>

      {/* ================================================================= */}
      {/* PREVIEW MODAL                                                     */}
      {/* ================================================================= */}
      {showPreview && pageData && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Page Preview"
          size="xl"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Globe className="w-4 h-4" />
              <a
                href={pageData.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {pageData.public_url}
              </a>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                src={pageData.public_url}
                className="w-full h-[500px] border-0"
                title="Page preview"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile overlay backdrop */}
      {(showLeftSidebar || showRightSidebar) && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-[5]"
          onClick={() => { setShowLeftSidebar(false); setShowRightSidebar(false); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// BLOCK PREVIEW - Simplified visual representations
// =============================================================================

function BlockPreview({ block }: { block: LandingPageBlock }) {
  const content = block.content as Record<string, string | FormField[] | undefined>;

  switch (block.type) {
    case 'hero': {
      const bgColor = (content.background_color as string) || '#4F46E5';
      return (
        <div
          className="rounded-md p-6 text-center"
          style={{ backgroundColor: bgColor }}
        >
          <h2 className="text-xl font-bold text-white">
            {(content.heading as string) || 'Hero Heading'}
          </h2>
          {content.subheading && (
            <p className="text-sm text-white/80 mt-2">
              {String(content.subheading)}
            </p>
          )}
          {content.cta_text && (
            <span className="inline-block mt-3 px-4 py-1.5 bg-white text-gray-800 text-sm rounded-md font-medium">
              {String(content.cta_text)}
            </span>
          )}
        </div>
      );
    }

    case 'text':
      return (
        <div>
          {content.heading && (
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              {String(content.heading)}
            </h3>
          )}
          <p className="text-sm text-gray-600 line-clamp-3">
            {(content.body as string) || 'Text content...'}
          </p>
        </div>
      );

    case 'image': {
      const imageUrl = content.url as string;
      return (
        <div className="text-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={(content.alt as string) || ''}
              className="max-h-40 mx-auto rounded-md object-contain"
            />
          ) : (
            <div className="h-32 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
              <Image className="w-8 h-8" />
            </div>
          )}
          {content.caption && (
            <p className="text-xs text-gray-500 mt-2">
              {String(content.caption)}
            </p>
          )}
        </div>
      );
    }

    case 'cta':
      return (
        <div className="text-center bg-gray-50 rounded-md p-5">
          <h3 className="text-base font-semibold text-gray-800">
            {(content.heading as string) || 'CTA Heading'}
          </h3>
          {content.description && (
            <p className="text-sm text-gray-500 mt-1">
              {String(content.description)}
            </p>
          )}
          {content.button_text && (
            <span className="inline-block mt-3 px-4 py-1.5 bg-primary text-white text-sm rounded-md font-medium">
              {String(content.button_text)}
            </span>
          )}
        </div>
      );

    case 'form': {
      const fields = (content.fields as FormField[]) || [];
      return (
        <div className="bg-gray-50 rounded-md p-4">
          {content.heading && (
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              {String(content.heading)}
            </h3>
          )}
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 min-w-[80px]">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <div className="flex-1 h-7 bg-white border border-gray-200 rounded text-xs text-gray-300 flex items-center px-2">
                  {field.placeholder || field.type}
                </div>
              </div>
            ))}
          </div>
          {content.submit_text && (
            <span className="inline-block mt-3 px-3 py-1 bg-primary text-white text-xs rounded font-medium">
              {String(content.submit_text)}
            </span>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-gray-400 italic">Unknown block type</p>
      );
  }
}

// =============================================================================
// BLOCK SETTINGS PANEL
// =============================================================================

function BlockSettings({
  block,
  onUpdateContent,
}: {
  block: LandingPageBlock;
  onUpdateContent: (blockId: string, key: string, value: unknown) => void;
}) {
  const content = block.content;

  const handleChange = (key: string, value: unknown) => {
    onUpdateContent(block.id, key, value);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">{getBlockLabel(block.type)}</Badge>
        <h3 className="text-sm font-semibold text-gray-700">Block Settings</h3>
      </div>

      <div className="space-y-4">
        {block.type === 'hero' && (
          <HeroSettings content={content} onChange={handleChange} />
        )}
        {block.type === 'text' && (
          <TextSettings content={content} onChange={handleChange} />
        )}
        {block.type === 'image' && (
          <ImageSettings content={content} onChange={handleChange} />
        )}
        {block.type === 'cta' && (
          <CTASettings content={content} onChange={handleChange} />
        )}
        {block.type === 'form' && (
          <FormSettings content={content} onChange={handleChange} />
        )}
      </div>
    </div>
  );
}

// ----- Hero Settings -----
function HeroSettings({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <Input
        label="Heading"
        value={(content.heading as string) || ''}
        onChange={(e) => onChange('heading', e.target.value)}
      />
      <Input
        label="Subheading"
        value={(content.subheading as string) || ''}
        onChange={(e) => onChange('subheading', e.target.value)}
      />
      <Input
        label="CTA Text"
        value={(content.cta_text as string) || ''}
        onChange={(e) => onChange('cta_text', e.target.value)}
      />
      <Input
        label="CTA URL"
        value={(content.cta_url as string) || ''}
        onChange={(e) => onChange('cta_url', e.target.value)}
        placeholder="https://..."
      />
      <div>
        <label className="label">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(content.background_color as string) || '#4F46E5'}
            onChange={(e) => onChange('background_color', e.target.value)}
            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={(content.background_color as string) || '#4F46E5'}
            onChange={(e) => onChange('background_color', e.target.value)}
            className="input text-sm flex-1"
          />
        </div>
      </div>
      <Input
        label="Background Image URL"
        value={(content.background_image as string) || ''}
        onChange={(e) => onChange('background_image', e.target.value)}
        placeholder="https://..."
        hint="Optional background image"
      />
    </>
  );
}

// ----- Text Settings -----
function TextSettings({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <Input
        label="Heading"
        value={(content.heading as string) || ''}
        onChange={(e) => onChange('heading', e.target.value)}
      />
      <div>
        <label className="label">Body</label>
        <textarea
          value={(content.body as string) || ''}
          onChange={(e) => onChange('body', e.target.value)}
          rows={6}
          className="input resize-y"
          placeholder="Enter your text content..."
        />
      </div>
    </>
  );
}

// ----- Image Settings -----
function ImageSettings({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <Input
        label="Image URL"
        value={(content.url as string) || ''}
        onChange={(e) => onChange('url', e.target.value)}
        placeholder="https://..."
      />
      <Input
        label="Alt Text"
        value={(content.alt as string) || ''}
        onChange={(e) => onChange('alt', e.target.value)}
        placeholder="Describe the image"
      />
      <Input
        label="Caption"
        value={(content.caption as string) || ''}
        onChange={(e) => onChange('caption', e.target.value)}
        placeholder="Optional caption"
      />
    </>
  );
}

// ----- CTA Settings -----
function CTASettings({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <Input
        label="Heading"
        value={(content.heading as string) || ''}
        onChange={(e) => onChange('heading', e.target.value)}
      />
      <div>
        <label className="label">Description</label>
        <textarea
          value={(content.description as string) || ''}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          className="input resize-y"
          placeholder="Describe your call to action..."
        />
      </div>
      <Input
        label="Button Text"
        value={(content.button_text as string) || ''}
        onChange={(e) => onChange('button_text', e.target.value)}
      />
      <Input
        label="Button URL"
        value={(content.button_url as string) || ''}
        onChange={(e) => onChange('button_url', e.target.value)}
        placeholder="https://..."
      />
    </>
  );
}

// ----- Form Settings -----
function FormSettings({
  content,
  onChange,
}: {
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const fields = ((content.fields as FormField[]) || []).map((f) => ({
    ...f,
    options: f.options || [],
  }));

  const updateField = (index: number, key: keyof FormField, value: unknown) => {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, [key]: value } : f
    );
    onChange('fields', updated);
  };

  const addField = () => {
    onChange('fields', [
      ...fields,
      {
        label: 'New Field',
        name: `field_${fields.length + 1}`,
        type: 'text' as const,
        required: false,
        placeholder: '',
        options: [],
      },
    ]);
  };

  const removeField = (index: number) => {
    onChange(
      'fields',
      fields.filter((_, i) => i !== index)
    );
  };

  return (
    <>
      <Input
        label="Form Heading"
        value={(content.heading as string) || ''}
        onChange={(e) => onChange('heading', e.target.value)}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Fields</label>
          <button
            onClick={addField}
            className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Field
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Field {idx + 1}
                </span>
                <button
                  onClick={() => removeField(idx)}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                  aria-label="Remove field"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Label</label>
                  <input
                    className="input text-sm py-1.5"
                    value={field.label}
                    onChange={(e) => updateField(idx, 'label', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Name</label>
                  <input
                    className="input text-sm py-1.5"
                    value={field.name}
                    onChange={(e) => updateField(idx, 'name', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Type</label>
                  <select
                    className="input text-sm py-1.5"
                    value={field.type}
                    onChange={(e) => updateField(idx, 'type', e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(idx, 'required', e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Required
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Placeholder</label>
                <input
                  className="input text-sm py-1.5"
                  value={field.placeholder}
                  onChange={(e) => updateField(idx, 'placeholder', e.target.value)}
                />
              </div>

              {field.type === 'select' && (
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">
                    Options (comma-separated)
                  </label>
                  <input
                    className="input text-sm py-1.5"
                    value={(field.options || []).join(', ')}
                    onChange={(e) =>
                      updateField(
                        idx,
                        'options',
                        e.target.value.split(',').map((o) => o.trim()).filter(Boolean)
                      )
                    }
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Input
        label="Submit Button Text"
        value={(content.submit_text as string) || ''}
        onChange={(e) => onChange('submit_text', e.target.value)}
      />

      <div>
        <label className="label">Success Message</label>
        <textarea
          value={(content.success_message as string) || ''}
          onChange={(e) => onChange('success_message', e.target.value)}
          rows={2}
          className="input resize-y"
          placeholder="Message shown after form submission"
        />
      </div>
    </>
  );
}

// =============================================================================
// PAGE-LEVEL SETTINGS PANEL
// =============================================================================

function PageSettings({
  title,
  slug,
  seoTitle,
  seoDescription,
  ogImageUrl,
  onTitleChange,
  onSlugChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onOgImageUrlChange,
}: {
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onSeoTitleChange: (v: string) => void;
  onSeoDescriptionChange: (v: string) => void;
  onOgImageUrlChange: (v: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Settings className="w-4 h-4" />
        Page Settings
      </h3>

      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <Input
          label="Slug"
          value={slug}
          onChange={(e) =>
            onSlugChange(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
            )
          }
          hint={slug ? `/p/${slug}` : 'URL path for your page'}
        />

        <hr className="border-gray-200" />

        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          SEO
        </h4>

        <Input
          label="SEO Title"
          value={seoTitle}
          onChange={(e) => onSeoTitleChange(e.target.value)}
          placeholder="Page title for search engines"
        />

        <div>
          <label className="label">SEO Description</label>
          <textarea
            value={seoDescription}
            onChange={(e) => onSeoDescriptionChange(e.target.value)}
            rows={3}
            className="input resize-y"
            placeholder="Description for search engines..."
          />
        </div>

        <Input
          label="OG Image URL"
          value={ogImageUrl}
          onChange={(e) => onOgImageUrlChange(e.target.value)}
          placeholder="https://..."
          hint="Social media sharing image"
        />
      </div>
    </div>
  );
}
