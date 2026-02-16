import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Save, Plus, Trash2, Edit3, Eye, EyeOff,
    ChevronDown, ChevronUp, Globe, ExternalLink, Smartphone,
    User, LinkIcon, Loader2, Check,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Modal, Badge, Loading } from '@/components/common';
import { bioAPI, getErrorMessage } from '@/services/api';
import toast from 'react-hot-toast';
import type {
    BioPage, BioLink, BioPageTheme, ButtonStyle, SocialLink,
    CreateBioPageData, UpdateBioPageData, CreateBioLinkData, UpdateBioLinkData,
} from '@/types';

// =============================================================================
// THEME PRESETS
// =============================================================================

const THEME_PRESETS: Record<BioPageTheme, { label: string; bg: string; text: string; desc: string }> = {
    minimal: { label: 'Minimal', bg: '#ffffff', text: '#111827', desc: 'Clean white background' },
    dark: { label: 'Dark', bg: '#111827', text: '#f9fafb', desc: 'Dark elegance' },
    colorful: { label: 'Colorful', bg: '#8b5cf6', text: '#ffffff', desc: 'Vibrant custom colors' },
    gradient: { label: 'Gradient', bg: '#6366f1', text: '#ffffff', desc: 'Smooth gradient flow' },
    professional: { label: 'Professional', bg: '#f8fafc', text: '#1e293b', desc: 'Business ready' },
};

const BUTTON_STYLES: { value: ButtonStyle; label: string }[] = [
    { value: 'rounded', label: 'Rounded' },
    { value: 'square', label: 'Square' },
    { value: 'pill', label: 'Pill' },
    { value: 'outline', label: 'Outline' },
];

const SOCIAL_PLATFORMS = [
    { value: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/you' },
    { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/you' },
    { value: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
    { value: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@you' },
    { value: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@you' },
    { value: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
    { value: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
    { value: 'email', label: 'Email', placeholder: 'mailto:you@example.com' },
    { value: 'other', label: 'Other', placeholder: 'https://...' },
];

const SOCIAL_PLATFORM_ABBREVS: Record<string, string> = {
    twitter: 'TW',
    instagram: 'IG',
    linkedin: 'LI',
    youtube: 'YT',
    tiktok: 'TK',
    github: 'GH',
    website: 'WEB',
    email: '@',
    other: '...',
};

// =============================================================================
// PREDEFINED TEMPLATES
// =============================================================================

interface BioPageTemplate {
    id: string;
    name: string;
    description: string;
    theme: BioPageTheme;
    backgroundColor: string;
    textColor: string;
    buttonColor: string;
    buttonTextColor: string;
    buttonStyle: ButtonStyle;
    sampleTitle: string;
    sampleBio: string;
    sampleLinks: string[];
    socialPlatforms: string[];
}

const BIO_PAGE_TEMPLATES: BioPageTemplate[] = [
    {
        id: 'creator',
        name: 'Content Creator',
        description: 'Perfect for influencers and social media creators',
        theme: 'colorful',
        backgroundColor: '#7c3aed',
        textColor: '#ffffff',
        buttonColor: '#f59e0b',
        buttonTextColor: '#111827',
        buttonStyle: 'pill',
        sampleTitle: 'Your Name',
        sampleBio: 'Content creator & storyteller. New videos every week!',
        sampleLinks: ['Latest Video', 'Merch Store', 'Collab Inquiries'],
        socialPlatforms: ['youtube', 'instagram', 'tiktok', 'twitter'],
    },
    {
        id: 'business',
        name: 'Business',
        description: 'Clean and professional for companies and brands',
        theme: 'professional',
        backgroundColor: '#f8fafc',
        textColor: '#1e293b',
        buttonColor: '#2563eb',
        buttonTextColor: '#ffffff',
        buttonStyle: 'rounded',
        sampleTitle: 'Company Name',
        sampleBio: 'Empowering businesses with innovative solutions.',
        sampleLinks: ['Our Services', 'Book a Demo', 'Contact Us'],
        socialPlatforms: ['linkedin', 'twitter', 'website'],
    },
    {
        id: 'portfolio',
        name: 'Portfolio',
        description: 'Showcase your work with a sleek dark layout',
        theme: 'dark',
        backgroundColor: '#111827',
        textColor: '#f9fafb',
        buttonColor: '#f9fafb',
        buttonTextColor: '#111827',
        buttonStyle: 'outline',
        sampleTitle: 'Your Name',
        sampleBio: 'Designer & Developer. Crafting digital experiences.',
        sampleLinks: ['View Portfolio', 'Case Studies', 'Hire Me'],
        socialPlatforms: ['github', 'linkedin', 'website'],
    },
    {
        id: 'musician',
        name: 'Musician',
        description: 'Promote your music and upcoming shows',
        theme: 'gradient',
        backgroundColor: '#4f46e5',
        textColor: '#ffffff',
        buttonColor: '#ec4899',
        buttonTextColor: '#ffffff',
        buttonStyle: 'pill',
        sampleTitle: 'Artist Name',
        sampleBio: 'New album out now. Tour dates below.',
        sampleLinks: ['Listen on Spotify', 'Apple Music', 'Tour Dates', 'Merch'],
        socialPlatforms: ['instagram', 'youtube', 'tiktok', 'twitter'],
    },
    {
        id: 'freelancer',
        name: 'Freelancer',
        description: 'Win clients with a polished personal brand',
        theme: 'gradient',
        backgroundColor: '#0891b2',
        textColor: '#ffffff',
        buttonColor: '#f97316',
        buttonTextColor: '#ffffff',
        buttonStyle: 'rounded',
        sampleTitle: 'Your Name',
        sampleBio: 'Freelance consultant. Helping brands grow.',
        sampleLinks: ['My Services', 'Book a Call', 'Testimonials', 'Blog'],
        socialPlatforms: ['linkedin', 'twitter', 'website', 'email'],
    },
    {
        id: 'restaurant',
        name: 'Restaurant & Cafe',
        description: 'Menu, reservations and delivery in one place',
        theme: 'colorful',
        backgroundColor: '#dc2626',
        textColor: '#ffffff',
        buttonColor: '#fbbf24',
        buttonTextColor: '#111827',
        buttonStyle: 'square',
        sampleTitle: 'Restaurant Name',
        sampleBio: 'Fresh. Local. Delicious. Open daily 11am-10pm.',
        sampleLinks: ['View Menu', 'Order Delivery', 'Reserve a Table', 'Gift Cards'],
        socialPlatforms: ['instagram', 'website'],
    },
    {
        id: 'minimal-personal',
        name: 'Personal',
        description: 'Simple and clean for a personal link hub',
        theme: 'minimal',
        backgroundColor: '#ffffff',
        textColor: '#111827',
        buttonColor: '#111827',
        buttonTextColor: '#ffffff',
        buttonStyle: 'rounded',
        sampleTitle: 'Your Name',
        sampleBio: 'Just a human on the internet.',
        sampleLinks: ['Blog', 'Photos', 'Contact'],
        socialPlatforms: ['twitter', 'instagram'],
    },
    {
        id: 'nonprofit',
        name: 'Non-Profit',
        description: 'Drive donations and awareness for your cause',
        theme: 'colorful',
        backgroundColor: '#059669',
        textColor: '#ffffff',
        buttonColor: '#ffffff',
        buttonTextColor: '#059669',
        buttonStyle: 'pill',
        sampleTitle: 'Organization Name',
        sampleBio: 'Making the world a better place, one step at a time.',
        sampleLinks: ['Donate Now', 'Our Mission', 'Volunteer', 'Events'],
        socialPlatforms: ['twitter', 'instagram', 'linkedin', 'website'],
    },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BioPageEditorPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEditMode = !!id;

    // -------------------------------------------------------------------------
    // Form state
    // -------------------------------------------------------------------------
    const [slug, setSlug] = useState('');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [theme, setTheme] = useState<BioPageTheme>('minimal');
    const [backgroundColor, setBackgroundColor] = useState('#ffffff');
    const [textColor, setTextColor] = useState('#111827');
    const [buttonColor, setButtonColor] = useState('#f6821f');
    const [buttonTextColor, setButtonTextColor] = useState('#ffffff');
    const [buttonStyle, setButtonStyle] = useState<ButtonStyle>('rounded');
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDescription, setSeoDescription] = useState('');
    const [isPublished, setIsPublished] = useState(false);

    // UI state
    const [avatarError, setAvatarError] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(true);
    const [seoExpanded, setSeoExpanded] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<BioLink | null>(null);
    const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
    const [slugChecking, setSlugChecking] = useState(false);
    const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [linkDeleteModalOpen, setLinkDeleteModalOpen] = useState(false);
    const [linkToDelete, setLinkToDelete] = useState<BioLink | null>(null);

    // Link modal form state
    const [linkTitle, setLinkTitle] = useState('');
    const [linkCustomUrl, setLinkCustomUrl] = useState('');
    const [linkDescription, setLinkDescription] = useState('');
    const [linkIcon, setLinkIcon] = useState('');

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------
    const { data: bioPage, isLoading: pageLoading } = useQuery({
        queryKey: ['bioPage', id],
        queryFn: () => bioAPI.get(id!),
        enabled: isEditMode,
    });

    const { data: bioLinks = [], isLoading: linksLoading } = useQuery({
        queryKey: ['bioLinks', id],
        queryFn: () => bioAPI.listLinks(id!),
        enabled: isEditMode,
    });

    // -------------------------------------------------------------------------
    // Sync fetched data to local state (React Query v5 pattern)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!bioPage) return;
        setSlug(bioPage.slug);
        setTitle(bioPage.title);
        setBio(bioPage.bio || '');
        setAvatarUrl(bioPage.avatar_url || '');
        setTheme(bioPage.theme);
        setBackgroundColor(bioPage.background_color || '#ffffff');
        setTextColor(bioPage.text_color || '#111827');
        setButtonColor(bioPage.button_color || '#f6821f');
        setButtonTextColor(bioPage.button_text_color || '#ffffff');
        setButtonStyle(bioPage.button_style || 'rounded');
        setSocialLinks(
            (bioPage.social_links || []).map(s => ({
                ...s,
                platform: s.platform.toLowerCase(),
            }))
        );
        setSeoTitle(bioPage.seo_title || '');
        setSeoDescription(bioPage.seo_description || '');
        setIsPublished(bioPage.is_published);
    }, [bioPage]);

    // Reset avatar error when URL changes
    useEffect(() => {
        setAvatarError(false);
    }, [avatarUrl]);

    // Track dirty state for unsaved changes warning
    const [isDirty, setIsDirty] = useState(false);
    const markDirty = useCallback(() => { if (!isDirty) setIsDirty(true); }, [isDirty]);

    // Mark dirty on any form field change (after initial load)
    useEffect(() => {
        if (isEditMode && !bioPage) return; // still loading
        // Skip the initial sync render
        const timer = setTimeout(() => markDirty(), 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, bio, avatarUrl, theme, backgroundColor, textColor, buttonColor, buttonTextColor, buttonStyle, socialLinks, seoTitle, seoDescription, isPublished]);

    // Warn on browser close/refresh with unsaved changes
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // -------------------------------------------------------------------------
    // Slug availability check (debounced)
    // -------------------------------------------------------------------------
    const checkSlugAvailability = useCallback((value: string) => {
        if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
        if (!value || value.length < 2) {
            setSlugAvailable(null);
            setSlugChecking(false);
            return;
        }
        setSlugChecking(true);
        slugCheckTimer.current = setTimeout(async () => {
            try {
                const result = await bioAPI.checkSlug(value);
                setSlugAvailable(result.available);
            } catch {
                setSlugAvailable(null);
            } finally {
                setSlugChecking(false);
            }
        }, 500);
    }, []);

    const handleSlugChange = (value: string) => {
        const sanitized = value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        setSlug(sanitized);
        if (!isEditMode) {
            checkSlugAvailability(sanitized);
        }
    };

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------
    const createMutation = useMutation({
        mutationFn: (data: CreateBioPageData) => bioAPI.create(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['bioPages'] });
            toast.success('Bio page created successfully!');
            navigate(`/dashboard/bio/${data.id}/edit`);
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateBioPageData) => bioAPI.update(id!, data),
        onSuccess: () => {
            setIsDirty(false);
            queryClient.invalidateQueries({ queryKey: ['bioPage', id] });
            queryClient.invalidateQueries({ queryKey: ['bioPages'] });
            toast.success('Bio page saved successfully!');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const createLinkMutation = useMutation({
        mutationFn: (data: CreateBioLinkData) => bioAPI.createLink(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioLinks', id] });
            toast.success('Link added!');
            closeLinkModal();
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const updateLinkMutation = useMutation({
        mutationFn: ({ linkId, data }: { linkId: string; data: UpdateBioLinkData }) =>
            bioAPI.updateLink(linkId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioLinks', id] });
            toast.success('Link updated!');
            closeLinkModal();
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const deleteLinkMutation = useMutation({
        mutationFn: (linkId: string) => bioAPI.deleteLink(linkId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioLinks', id] });
            toast.success('Link deleted.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const toggleLinkActiveMutation = useMutation({
        mutationFn: ({ linkId, isActive }: { linkId: string; isActive: boolean }) =>
            bioAPI.updateLink(linkId, { is_active: isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioLinks', id] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const reorderLinksMutation = useMutation({
        mutationFn: (linkIds: string[]) => bioAPI.reorderLinks(id!, linkIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioLinks', id] });
        },
        onError: (error) => {
            toast.error(getErrorMessage(error));
        },
    });

    const handleMoveLink = (linkId: string, direction: 'up' | 'down') => {
        const sorted = [...bioLinks].sort((a, b) => a.position - b.position);
        const index = sorted.findIndex(l => l.id === linkId);
        if (index < 0) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sorted.length - 1) return;

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const reordered = [...sorted];
        [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
        reorderLinksMutation.mutate(reordered.map(l => l.id));
    };

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------
    const handleSave = () => {
        if (!title.trim()) {
            toast.error('Title is required.');
            return;
        }

        const formData = {
            slug,
            title: title.trim(),
            bio: bio.trim(),
            avatar_url: avatarUrl.trim(),
            theme,
            background_color: backgroundColor,
            text_color: textColor,
            button_color: buttonColor,
            button_text_color: buttonTextColor,
            button_style: buttonStyle,
            social_links: socialLinks.filter(s => s.platform.trim() && s.url.trim()),
            seo_title: seoTitle.trim(),
            seo_description: seoDescription.trim(),
        };

        if (isEditMode) {
            updateMutation.mutate({ ...formData, is_published: isPublished });
        } else {
            if (!slug.trim()) {
                toast.error('Slug is required.');
                return;
            }
            if (slugAvailable === false) {
                toast.error('This slug is already taken.');
                return;
            }
            createMutation.mutate(formData);
        }
    };

    const openAddLinkModal = () => {
        setEditingLink(null);
        setLinkTitle('');
        setLinkCustomUrl('');
        setLinkDescription('');
        setLinkIcon('');
        setLinkModalOpen(true);
    };

    const openEditLinkModal = (link: BioLink) => {
        setEditingLink(link);
        setLinkTitle(link.title);
        setLinkCustomUrl(link.custom_url);
        setLinkDescription(link.description || '');
        setLinkIcon(link.icon || '');
        setLinkModalOpen(true);
    };

    const closeLinkModal = () => {
        setLinkModalOpen(false);
        setEditingLink(null);
        setLinkTitle('');
        setLinkCustomUrl('');
        setLinkDescription('');
        setLinkIcon('');
    };

    const handleLinkSubmit = () => {
        if (!linkTitle.trim()) {
            toast.error('Link title is required.');
            return;
        }
        if (!linkCustomUrl.trim()) {
            toast.error('URL is required.');
            return;
        }

        if (editingLink) {
            updateLinkMutation.mutate({
                linkId: editingLink.id,
                data: {
                    title: linkTitle.trim(),
                    custom_url: linkCustomUrl.trim(),
                    description: linkDescription.trim(),
                    icon: linkIcon.trim(),
                },
            });
        } else {
            createLinkMutation.mutate({
                title: linkTitle.trim(),
                custom_url: linkCustomUrl.trim(),
                description: linkDescription.trim() || undefined,
                icon: linkIcon.trim() || undefined,
            });
        }
    };

    // Social links helpers
    const addSocialLink = () => {
        setSocialLinks([...socialLinks, { platform: '', url: '' }]);
    };

    const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
        const updated = [...socialLinks];
        updated[index] = { ...updated[index], [field]: value };
        setSocialLinks(updated);
    };

    const removeSocialLink = (index: number) => {
        setSocialLinks(socialLinks.filter((_, i) => i !== index));
    };

    const handleDeleteLinkClick = (link: BioLink) => {
        setLinkToDelete(link);
        setLinkDeleteModalOpen(true);
    };

    const confirmDeleteLink = () => {
        if (linkToDelete) {
            deleteLinkMutation.mutate(linkToDelete.id);
            setLinkDeleteModalOpen(false);
            setLinkToDelete(null);
        }
    };

    // -------------------------------------------------------------------------
    // Theme change handler — syncs preset colors to state
    // -------------------------------------------------------------------------
    const handleThemeChange = (newTheme: BioPageTheme) => {
        setTheme(newTheme);
        const preset = THEME_PRESETS[newTheme];
        setBackgroundColor(preset.bg);
        setTextColor(preset.text);
    };

    // -------------------------------------------------------------------------
    // Template handler — populates all form fields from a template
    // -------------------------------------------------------------------------
    const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

    const handleApplyTemplate = (template: BioPageTemplate) => {
        setActiveTemplate(template.id);
        setTheme(template.theme);
        setBackgroundColor(template.backgroundColor);
        setTextColor(template.textColor);
        setButtonColor(template.buttonColor);
        setButtonTextColor(template.buttonTextColor);
        setButtonStyle(template.buttonStyle);
        setBio(template.sampleBio);
        setSocialLinks(template.socialPlatforms.map(p => ({ platform: p, url: '' })));
        toast.success(`"${template.name}" template applied`);
    };

    // -------------------------------------------------------------------------
    // Preview helpers
    // -------------------------------------------------------------------------
    const getPreviewBackground = (): string => {
        if (theme === 'gradient') {
            return `linear-gradient(135deg, ${backgroundColor}, ${buttonColor})`;
        }
        return backgroundColor;
    };

    const getPreviewTextColor = (): string => {
        return textColor;
    };

    const getButtonBorderRadius = (): string => {
        switch (buttonStyle) {
            case 'rounded':
                return '8px';
            case 'square':
                return '0px';
            case 'pill':
                return '9999px';
            case 'outline':
                return '8px';
            default:
                return '8px';
        }
    };

    const getButtonStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            borderRadius: getButtonBorderRadius(),
            padding: '12px 20px',
            width: '100%',
            textAlign: 'center',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'transform 0.15s',
            display: 'block',
        };

        if (buttonStyle === 'outline') {
            return {
                ...base,
                backgroundColor: 'transparent',
                color: buttonColor,
                border: `2px solid ${buttonColor}`,
            };
        }

        return {
            ...base,
            backgroundColor: buttonColor,
            color: buttonTextColor,
            border: 'none',
        };
    };

    // -------------------------------------------------------------------------
    // Loading state
    // -------------------------------------------------------------------------
    if (isEditMode && pageLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loading size="lg" />
            </div>
        );
    }

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const previewBg = getPreviewBackground();
    const previewText = getPreviewTextColor();

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to="/dashboard/bio"
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Bio Page' : 'Create Bio Page'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {isEditMode
                                ? 'Update your bio page settings and links'
                                : 'Set up your personalized bio link page'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && bioPage?.public_url && (
                        <a
                            href={bioPage.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View Live
                        </a>
                    )}
                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        leftIcon={<Save className="w-4 h-4" />}
                    >
                        {isEditMode ? 'Save Changes' : 'Create Page'}
                    </Button>
                </div>
            </div>

            {/* Template Picker — only in create mode */}
            {!isEditMode && (
                <Card>
                    <CardHeader>
                        <CardTitle>Start from a Template</CardTitle>
                        <CardDescription>Pick a template to pre-fill your page settings, or start from scratch</CardDescription>
                    </CardHeader>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {BIO_PAGE_TEMPLATES.map((tpl) => {
                            const isActive = activeTemplate === tpl.id;
                            const tplBg = tpl.theme === 'gradient'
                                ? `linear-gradient(135deg, ${tpl.backgroundColor}, ${tpl.buttonColor})`
                                : tpl.backgroundColor;
                            const needsBorder = tpl.backgroundColor === '#ffffff' || tpl.backgroundColor === '#f8fafc';

                            return (
                                <button
                                    key={tpl.id}
                                    onClick={() => handleApplyTemplate(tpl)}
                                    className={`relative rounded-xl border-2 transition-all text-left overflow-hidden ${
                                        isActive
                                            ? 'border-primary ring-2 ring-primary/20 ring-offset-2'
                                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                    }`}
                                >
                                    {/* Selected indicator */}
                                    {isActive && (
                                        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}

                                    {/* Mini page preview */}
                                    <div
                                        className="w-full h-28 flex flex-col items-center justify-center gap-1.5 px-3"
                                        style={{
                                            background: tplBg,
                                            border: needsBorder ? '1px solid #e5e7eb' : 'none',
                                            borderBottom: 'none',
                                        }}
                                    >
                                        {/* Mini avatar */}
                                        <div
                                            className="w-6 h-6 rounded-full"
                                            style={{ backgroundColor: tpl.textColor, opacity: 0.5 }}
                                        />
                                        {/* Mini title */}
                                        <div
                                            className="w-14 h-1.5 rounded-full"
                                            style={{ backgroundColor: tpl.textColor, opacity: 0.4 }}
                                        />
                                        {/* Mini buttons */}
                                        {tpl.sampleLinks.slice(0, 3).map((_, i) => (
                                            <div
                                                key={i}
                                                className="h-2.5 w-20"
                                                style={{
                                                    backgroundColor: tpl.buttonStyle === 'outline' ? 'transparent' : tpl.buttonColor,
                                                    border: tpl.buttonStyle === 'outline' ? `1.5px solid ${tpl.buttonColor}` : 'none',
                                                    borderRadius: tpl.buttonStyle === 'pill' ? '9999px'
                                                        : tpl.buttonStyle === 'square' ? '0px'
                                                        : '3px',
                                                    opacity: 0.8,
                                                }}
                                            />
                                        ))}
                                    </div>

                                    {/* Label */}
                                    <div className="px-3 py-2.5 bg-white">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</p>
                                        <p className="text-xs text-gray-500 leading-tight mt-0.5 line-clamp-2">{tpl.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Settings + Links */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Page Settings</CardTitle>
                            <CardDescription>Configure your bio page appearance</CardDescription>
                        </CardHeader>

                        <div className="space-y-4">
                            {/* Slug */}
                            <div>
                                <label className="label">Slug</label>
                                {isEditMode ? (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-md">
                                        <span className="text-sm text-gray-400">@</span>
                                        <span className="text-sm font-medium text-gray-700">{slug}</span>
                                        {bioPage?.public_url && (
                                            <>
                                                <span className="text-gray-300">|</span>
                                                <a
                                                    href={bioPage.public_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-primary hover:underline truncate"
                                                >
                                                    {bioPage.public_url}
                                                </a>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center border border-gray-300 rounded-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-200">
                                        <span className="flex items-center pl-3 pr-1 text-gray-400 text-sm font-medium select-none flex-shrink-0">
                                            @
                                        </span>
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={(e) => handleSlugChange(e.target.value)}
                                            placeholder="yourname"
                                            className="flex-1 min-w-0 py-3 pr-3 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-400"
                                        />
                                        {slug.length >= 2 && (
                                            <span className="flex items-center pr-3 flex-shrink-0">
                                                {slugChecking ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                ) : slugAvailable === true ? (
                                                    <span className="text-xs font-medium text-green-600 whitespace-nowrap">Available</span>
                                                ) : slugAvailable === false ? (
                                                    <span className="text-xs font-medium text-red-500 whitespace-nowrap">Taken</span>
                                                ) : null}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Title */}
                            <Input
                                label="Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Your Name or Brand"
                            />

                            {/* Bio */}
                            <div>
                                <label className="label">Bio</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value.slice(0, 500))}
                                    placeholder="Tell people about yourself..."
                                    rows={3}
                                    maxLength={500}
                                    className="input resize-none"
                                />
                                <p className="mt-1 text-xs text-gray-400 text-right">
                                    {bio.length}/500
                                </p>
                            </div>

                            {/* Avatar URL */}
                            <Input
                                label="Avatar URL"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://example.com/avatar.jpg"
                                leftIcon={<User className="w-4 h-4" />}
                            />
                        </div>
                    </Card>

                    {/* Theme */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Theme</CardTitle>
                            <CardDescription>Choose a visual style for your page</CardDescription>
                        </CardHeader>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            {(Object.entries(THEME_PRESETS) as [BioPageTheme, typeof THEME_PRESETS[BioPageTheme]][]).map(
                                ([key, preset]) => {
                                    const isSelected = theme === key;
                                    const swatchBg = key === 'gradient'
                                        ? `linear-gradient(135deg, ${preset.bg}, #a855f7)`
                                        : preset.bg;
                                    const needsBorder = key === 'minimal' || key === 'professional';

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleThemeChange(key)}
                                            className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                                                isSelected
                                                    ? 'border-primary ring-2 ring-primary/20 ring-offset-2'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {/* Selected checkmark */}
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}

                                            {/* Mini-preview swatch */}
                                            <div
                                                className="w-full h-16 rounded-lg mb-2 flex flex-col items-center justify-center gap-1 overflow-hidden"
                                                style={{
                                                    background: swatchBg,
                                                    border: needsBorder ? '1px solid #e5e7eb' : 'none',
                                                }}
                                            >
                                                {/* Mini avatar circle */}
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{
                                                        backgroundColor: preset.text,
                                                        opacity: 0.6,
                                                    }}
                                                />
                                                {/* Mini title bar */}
                                                <div
                                                    className="w-10 h-1 rounded-full"
                                                    style={{
                                                        backgroundColor: preset.text,
                                                        opacity: 0.5,
                                                    }}
                                                />
                                                {/* Mini button strips */}
                                                <div
                                                    className="w-12 h-1.5 rounded-full"
                                                    style={{
                                                        backgroundColor: preset.text,
                                                        opacity: 0.3,
                                                    }}
                                                />
                                                <div
                                                    className="w-12 h-1.5 rounded-full"
                                                    style={{
                                                        backgroundColor: preset.text,
                                                        opacity: 0.3,
                                                    }}
                                                />
                                            </div>

                                            <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
                                            <p className="text-xs text-gray-500 leading-tight mt-0.5">{preset.desc}</p>
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </Card>

                    {/* Colors & Button Style */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Colors & Style</CardTitle>
                            <CardDescription>Customize colors and button appearance</CardDescription>
                        </CardHeader>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="label">Background</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={backgroundColor}
                                            onChange={(e) => setBackgroundColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={backgroundColor}
                                            onChange={(e) => setBackgroundColor(e.target.value)}
                                            className="input text-xs flex-1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Text</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={textColor}
                                            onChange={(e) => setTextColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={textColor}
                                            onChange={(e) => setTextColor(e.target.value)}
                                            className="input text-xs flex-1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Button</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={buttonColor}
                                            onChange={(e) => setButtonColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={buttonColor}
                                            onChange={(e) => setButtonColor(e.target.value)}
                                            className="input text-xs flex-1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Button Text</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={buttonTextColor}
                                            onChange={(e) => setButtonTextColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={buttonTextColor}
                                            onChange={(e) => setButtonTextColor(e.target.value)}
                                            className="input text-xs flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Button Style */}
                            <div>
                                <label className="label">Button Style</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {BUTTON_STYLES.map((style) => (
                                        <button
                                            key={style.value}
                                            onClick={() => setButtonStyle(style.value)}
                                            className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                                                buttonStyle === style.value
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Social Links */}
                    <Card>
                        <CardHeader
                            action={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={addSocialLink}
                                    leftIcon={<Plus className="w-4 h-4" />}
                                >
                                    Add
                                </Button>
                            }
                        >
                            <CardTitle>Social Links</CardTitle>
                            <CardDescription>Add your social media profiles</CardDescription>
                        </CardHeader>

                        {socialLinks.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">
                                No social links added yet. Click "Add" to get started.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {socialLinks.map((link, index) => {
                                    const matched = SOCIAL_PLATFORMS.find(p => p.value === link.platform);
                                    const urlPlaceholder = matched?.placeholder || 'https://...';
                                    const abbrev = link.platform ? (SOCIAL_PLATFORM_ABBREVS[link.platform] || '?') : '?';
                                    return (
                                        <div key={index} className="relative p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                            {/* Delete button — always visible on mobile, hover on desktop */}
                                            <button
                                                onClick={() => removeSocialLink(index)}
                                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                            <div className="flex items-start gap-3">
                                                {/* Platform badge */}
                                                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 mt-0.5">
                                                    {abbrev}
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-2">
                                                    {/* Platform select */}
                                                    <select
                                                        value={link.platform}
                                                        onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                                                        className="input text-sm w-full"
                                                    >
                                                        <option value="">Select platform</option>
                                                        {SOCIAL_PLATFORMS.map((p) => (
                                                            <option key={p.value} value={p.value}>{p.label}</option>
                                                        ))}
                                                    </select>

                                                    {/* URL input */}
                                                    <input
                                                        type="text"
                                                        value={link.url}
                                                        onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                                                        placeholder={urlPlaceholder}
                                                        className="input text-sm w-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    {/* SEO Section (Collapsible) */}
                    <Card>
                        <button
                            onClick={() => setSeoExpanded(!seoExpanded)}
                            className="w-full flex items-center justify-between"
                        >
                            <div className="text-left">
                                <h3 className="text-lg font-semibold text-gray-900">SEO Settings</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Optimize for search engines</p>
                            </div>
                            {seoExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                        </button>

                        {seoExpanded && (
                            <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
                                <Input
                                    label="SEO Title"
                                    value={seoTitle}
                                    onChange={(e) => setSeoTitle(e.target.value)}
                                    placeholder="Page title for search engines"
                                    hint="Leave blank to use the page title"
                                />
                                <div>
                                    <label className="label">SEO Description</label>
                                    <textarea
                                        value={seoDescription}
                                        onChange={(e) => setSeoDescription(e.target.value)}
                                        placeholder="Brief description for search engine results"
                                        rows={2}
                                        className="input resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Publish Toggle */}
                    {isEditMode && (
                        <Card>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Publish</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {isPublished
                                            ? 'Your page is live and visible to everyone'
                                            : 'Your page is hidden from the public'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsPublished(!isPublished)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        isPublished ? 'bg-primary' : 'bg-gray-300'
                                    }`}
                                    role="switch"
                                    aria-checked={isPublished}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            isPublished ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                            {isPublished && bioPage?.public_url && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                                    <Globe className="w-4 h-4" />
                                    <a
                                        href={bioPage.public_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline truncate"
                                    >
                                        {bioPage.public_url}
                                    </a>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Bio Links List (only in edit mode) */}
                    {isEditMode && (
                        <Card>
                            <CardHeader
                                action={
                                    <Button
                                        size="sm"
                                        onClick={openAddLinkModal}
                                        leftIcon={<Plus className="w-4 h-4" />}
                                    >
                                        Add Link
                                    </Button>
                                }
                            >
                                <CardTitle>Links</CardTitle>
                                <CardDescription>Manage the links shown on your bio page</CardDescription>
                            </CardHeader>

                            {linksLoading ? (
                                <div className="py-8">
                                    <Loading />
                                </div>
                            ) : bioLinks.length === 0 ? (
                                <div className="text-center py-8">
                                    <LinkIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">No links yet. Add your first link above.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {[...bioLinks]
                                        .sort((a, b) => a.position - b.position)
                                        .map((link, index, sortedArr) => (
                                            <div
                                                key={link.id}
                                                className="flex items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                                            >
                                                {/* Reorder buttons */}
                                                <div className="flex flex-col gap-0.5 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleMoveLink(link.id, 'up')}
                                                        disabled={index === 0 || reorderLinksMutation.isPending}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                                                        title="Move up"
                                                    >
                                                        <ChevronUp className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveLink(link.id, 'down')}
                                                        disabled={index === sortedArr.length - 1 || reorderLinksMutation.isPending}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                                                        title="Move down"
                                                    >
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                            {link.title}
                                                        </p>
                                                        {!link.is_active && (
                                                            <Badge variant="default">Hidden</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                                        {link.custom_url || link.link_short_url || 'No URL'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={() =>
                                                            toggleLinkActiveMutation.mutate({
                                                                linkId: link.id,
                                                                isActive: !link.is_active,
                                                            })
                                                        }
                                                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-md transition-colors"
                                                        title={link.is_active ? 'Hide link' : 'Show link'}
                                                    >
                                                        {link.is_active ? (
                                                            <Eye className="w-4 h-4" />
                                                        ) : (
                                                            <EyeOff className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => openEditLinkModal(link)}
                                                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-md transition-colors"
                                                        title="Edit link"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLinkClick(link)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                        title="Delete link"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                                                    {link.total_clicks} clicks
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                {/* Right Panel: Live Preview */}
                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-6">
                        {/* Preview header with mobile toggle */}
                        <button
                            onClick={() => setPreviewOpen(!previewOpen)}
                            className="w-full flex items-center justify-between mb-3 lg:pointer-events-none"
                        >
                            <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-600">Live Preview</span>
                            </div>
                            <div className="lg:hidden">
                                {previewOpen ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                        </button>

                        {/* Phone frame — always visible on lg+, collapsible on mobile */}
                        <div className={`${previewOpen ? 'block' : 'hidden'} lg:block`}>
                            <div className="mx-auto w-[320px] lg:w-[340px] max-w-full">
                                <div
                                    className="relative rounded-[2.5rem] border-[6px] border-gray-800 shadow-2xl overflow-hidden"
                                    style={{ minHeight: '580px' }}
                                >
                                    {/* Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-800 rounded-b-2xl z-10" />

                                    {/* Screen content */}
                                    <div
                                        className="h-full overflow-y-auto"
                                        style={{
                                            background: previewBg,
                                            minHeight: '568px',
                                        }}
                                    >
                                        <div className="px-5 pt-10 pb-6 flex flex-col items-center">
                                            {/* Avatar */}
                                            {avatarUrl && !avatarError ? (
                                                <img
                                                    src={avatarUrl}
                                                    alt="Avatar"
                                                    className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                                                    onError={() => setAvatarError(true)}
                                                />
                                            ) : (
                                                <div
                                                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-lg"
                                                    style={{
                                                        backgroundColor: buttonColor,
                                                        color: buttonTextColor,
                                                    }}
                                                >
                                                    {title ? title.charAt(0).toUpperCase() : '?'}
                                                </div>
                                            )}

                                            {/* Title */}
                                            <h2
                                                className="mt-3 text-base font-bold text-center"
                                                style={{ color: previewText }}
                                            >
                                                {title || 'Your Name'}
                                            </h2>

                                            {/* Bio */}
                                            {bio && (
                                                <p
                                                    className="mt-1.5 text-xs text-center leading-relaxed max-w-[240px]"
                                                    style={{ color: previewText, opacity: 0.8 }}
                                                >
                                                    {bio}
                                                </p>
                                            )}

                                            {/* Social links row */}
                                            {socialLinks.filter(s => s.platform).length > 0 && (
                                                <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                                                    {socialLinks
                                                        .filter(s => s.platform)
                                                        .map((social, index) => (
                                                            <div
                                                                key={index}
                                                                className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                                                                style={{
                                                                    backgroundColor: `${previewText}15`,
                                                                    color: previewText,
                                                                }}
                                                                title={social.platform}
                                                            >
                                                                {SOCIAL_PLATFORM_ABBREVS[social.platform] || social.platform.charAt(0).toUpperCase()}
                                                            </div>
                                                        ))}
                                                </div>
                                            )}

                                            {/* Links */}
                                            <div className="mt-5 w-full space-y-2.5">
                                                {isEditMode && bioLinks.length > 0 ? (
                                                    [...bioLinks]
                                                        .sort((a, b) => a.position - b.position)
                                                        .filter((link) => link.is_active)
                                                        .map((link) => (
                                                            <div
                                                                key={link.id}
                                                                style={getButtonStyles()}
                                                            >
                                                                {link.title}
                                                            </div>
                                                        ))
                                                ) : !isEditMode ? (
                                                    <>
                                                        {(BIO_PAGE_TEMPLATES.find(t => t.id === activeTemplate)?.sampleLinks || ['My Website', 'Portfolio', 'Contact Me']).map((label, i) => (
                                                            <div key={i} style={getButtonStyles()}>{label}</div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <p
                                                        className="text-xs text-center opacity-50"
                                                        style={{ color: previewText }}
                                                    >
                                                        Add links to see them here
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Link Modal */}
            <Modal
                isOpen={linkModalOpen}
                onClose={closeLinkModal}
                title={editingLink ? 'Edit Link' : 'Add Link'}
            >
                <div className="space-y-4">
                    <Input
                        label="Title"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="My Website"
                    />
                    <Input
                        label="URL"
                        value={linkCustomUrl}
                        onChange={(e) => setLinkCustomUrl(e.target.value)}
                        placeholder="https://example.com"
                        leftIcon={<Globe className="w-4 h-4" />}
                    />
                    <div>
                        <label className="label">Description (optional)</label>
                        <textarea
                            value={linkDescription}
                            onChange={(e) => setLinkDescription(e.target.value)}
                            placeholder="Brief description of this link"
                            rows={2}
                            className="input resize-none"
                        />
                    </div>
                    <Input
                        label="Icon (optional)"
                        value={linkIcon}
                        onChange={(e) => setLinkIcon(e.target.value)}
                        placeholder="Icon name or emoji"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={closeLinkModal}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleLinkSubmit}
                            isLoading={createLinkMutation.isPending || updateLinkMutation.isPending}
                        >
                            {editingLink ? 'Save' : 'Add Link'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Link Confirmation Modal */}
            <Modal
                isOpen={linkDeleteModalOpen}
                onClose={() => { setLinkDeleteModalOpen(false); setLinkToDelete(null); }}
                title="Delete Link"
            >
                <div className="space-y-4">
                    {linkToDelete && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{linkToDelete.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                {linkToDelete.custom_url || linkToDelete.link_short_url || 'No URL'}
                            </p>
                        </div>
                    )}
                    <p className="text-gray-600">
                        Are you sure you want to delete this link? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => { setLinkDeleteModalOpen(false); setLinkToDelete(null); }}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={confirmDeleteLink} isLoading={deleteLinkMutation.isPending}>
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
