import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, FileText, Layout, Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge, EmptyState, Skeleton } from '@/components/common';
import { pagesAPI, getErrorMessage } from '@/services/api';
import type { LandingPageTemplate } from '@/types';
import toast from 'react-hot-toast';

function generateSlug() {
  return 'page-' + Math.random().toString(36).substring(2, 8);
}

const GRADIENT_COLORS = [
  'from-orange-400 to-pink-500',
  'from-blue-400 to-indigo-500',
  'from-green-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-yellow-400 to-orange-500',
  'from-cyan-400 to-blue-500',
];

function SkeletonTemplateCard() {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="h-48 bg-gray-100">
        <Skeleton height={192} className="w-full" />
      </div>
      <div className="p-4">
        <Skeleton height={18} className="w-32 mb-2" />
        <Skeleton height={14} className="w-full mb-1" />
        <Skeleton height={14} className="w-2/3 mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton height={22} className="w-16" />
          <Skeleton height={36} className="w-28" />
        </div>
      </div>
    </Card>
  );
}

export function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['landingPageTemplates'],
    queryFn: () => pagesAPI.getTemplates(),
  });

  const createFromTemplate = useMutation({
    mutationFn: (template: LandingPageTemplate) =>
      pagesAPI.create({
        slug: generateSlug(),
        title: template.name,
        blocks: template.blocks,
        settings: template.settings,
        template_id: template.id,
      }),
    onSuccess: (page) => {
      toast.success('Page created from template');
      navigate(`/dashboard/pages/${page.id}/edit`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const templateList = templates || [];
  const categories = ['all', ...Array.from(new Set(templateList.map((t) => t.category).filter(Boolean)))];
  const filtered = categoryFilter === 'all' ? templateList : templateList.filter((t) => t.category === categoryFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard/pages')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Template Gallery</h1>
            <p className="text-sm text-gray-500">Choose a template to get started quickly</p>
          </div>
        </div>
        <Button
          variant="outline"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/dashboard/pages/new')}
        >
          Start from Scratch
        </Button>
      </div>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All Templates' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTemplateCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<Layout className="h-6 w-6" />}
          title="No templates available"
          description={
            categoryFilter !== 'all'
              ? 'No templates found in this category. Try a different filter.'
              : 'Templates will appear here once they are created by the admin.'
          }
          action={
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/dashboard/pages/new')}
            >
              Start from Scratch
            </Button>
          }
        />
      )}

      {/* Template Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((template, index) => (
            <Card
              key={template.id}
              padding="none"
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            >
              {/* Thumbnail */}
              {template.thumbnail_url ? (
                <div className="h-48 overflow-hidden">
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div
                  className={`h-48 bg-gradient-to-br ${GRADIENT_COLORS[index % GRADIENT_COLORS.length]} flex items-center justify-center`}
                >
                  <div className="text-center text-white">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold opacity-90">{template.name}</p>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {template.category && (
                    <Badge variant="default">{template.category}</Badge>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={createFromTemplate.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      createFromTemplate.mutate(template);
                    }}
                  >
                    Use Template
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
