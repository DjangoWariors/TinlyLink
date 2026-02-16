import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Edit2, Target, Power,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge, Loading, EmptyState, Modal } from '@/components/common';
import { pixelsAPI, getErrorMessage } from '@/services/api';
import type { RetargetingPixel, CreatePixelData, PixelPlatform } from '@/types';
import toast from 'react-hot-toast';

const PLATFORM_LABELS: Record<PixelPlatform, string> = {
  facebook: 'Facebook Pixel',
  google: 'Google Ads',
  tiktok: 'TikTok Pixel',
  twitter: 'Twitter/X Pixel',
  linkedin: 'LinkedIn Insight',
  snapchat: 'Snapchat Pixel',
  pinterest: 'Pinterest Tag',
  custom: 'Custom Script',
};

const PLATFORM_COLORS: Record<PixelPlatform, string> = {
  facebook: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-800 text-white',
  twitter: 'bg-sky-100 text-sky-700',
  linkedin: 'bg-blue-100 text-blue-800',
  snapchat: 'bg-yellow-100 text-yellow-700',
  pinterest: 'bg-red-100 text-red-600',
  custom: 'bg-purple-100 text-purple-700',
};

const PLATFORMS: PixelPlatform[] = [
  'facebook', 'google', 'tiktok', 'twitter',
  'linkedin', 'snapchat', 'pinterest', 'custom',
];

export function PixelsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingPixel, setEditingPixel] = useState<RetargetingPixel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RetargetingPixel | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState<PixelPlatform>('facebook');
  const [formPixelId, setFormPixelId] = useState('');
  const [formCustomScript, setFormCustomScript] = useState('');

  const { data: pixels = [], isLoading } = useQuery({
    queryKey: ['pixels'],
    queryFn: () => pixelsAPI.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePixelData) => pixelsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixels'] });
      toast.success('Pixel created');
      closeModal();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RetargetingPixel> }) =>
      pixelsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixels'] });
      toast.success('Pixel updated');
      closeModal();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pixelsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixels'] });
      toast.success('Pixel deleted');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      pixelsAPI.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixels'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const resetForm = () => {
    setFormName('');
    setFormPlatform('facebook');
    setFormPixelId('');
    setFormCustomScript('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPixel(null);
    resetForm();
  };

  const openEdit = (pixel: RetargetingPixel) => {
    setEditingPixel(pixel);
    setFormName(pixel.name);
    setFormPlatform(pixel.platform);
    setFormPixelId(pixel.pixel_id);
    setFormCustomScript(pixel.custom_script);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formPixelId.trim()) {
      toast.error('Name and Pixel ID are required');
      return;
    }

    const data: CreatePixelData = {
      name: formName,
      platform: formPlatform,
      pixel_id: formPixelId,
      custom_script: formPlatform === 'custom' ? formCustomScript : '',
    };

    if (editingPixel) {
      updateMutation.mutate({ id: editingPixel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Retargeting Pixels</h1>
        </div>
        <div className="flex justify-center py-12"><Loading /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retargeting Pixels</h1>
          <p className="text-sm text-gray-500 mt-1">
            Attach tracking pixels to your links to build retargeting audiences.
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => { resetForm(); setShowModal(true); }}
        >
          Add Pixel
        </Button>
      </div>

      {/* Pixels List */}
      {pixels.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="w-10 h-10" />}
            title="No retargeting pixels"
            description="Create a pixel to start tracking clicks across Facebook, Google, TikTok, and more."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pixels.map((pixel) => (
            <Card key={pixel.id} padding="none">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${PLATFORM_COLORS[pixel.platform]}`}>
                      {PLATFORM_LABELS[pixel.platform]}
                    </span>
                    {!pixel.is_active && (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleMutation.mutate({ id: pixel.id, is_active: !pixel.is_active })}
                      className={`p-1.5 rounded-md transition-colors ${
                        pixel.is_active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={pixel.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(pixel)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(pixel)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{pixel.name}</h3>
                <p className="text-sm text-gray-500 font-mono truncate" title={pixel.pixel_id}>
                  ID: {pixel.pixel_id}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {pixel.links_count ?? 0} link{(pixel.links_count ?? 0) !== 1 ? 's' : ''} attached
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingPixel ? 'Edit Pixel' : 'Add Pixel'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Facebook - Main Campaign"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={formPlatform}
              onChange={(e) => setFormPlatform(e.target.value as PixelPlatform)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formPlatform === 'custom' ? 'Script Identifier' : 'Pixel ID'}
            </label>
            <input
              type="text"
              value={formPixelId}
              onChange={(e) => setFormPixelId(e.target.value)}
              placeholder={
                formPlatform === 'facebook' ? 'e.g., 123456789012345' :
                formPlatform === 'google' ? 'e.g., AW-123456789' :
                'Enter your pixel/tag ID'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
            />
          </div>

          {formPlatform === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Script
              </label>
              <textarea
                value={formCustomScript}
                onChange={(e) => setFormCustomScript(e.target.value)}
                placeholder="Paste your tracking script here..."
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Script will be injected on link click. Available on paid plans only.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingPixel ? 'Save Changes' : 'Create Pixel'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Pixel"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> This pixel will be removed from all attached links.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Delete <strong>{deleteTarget?.name}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              isLoading={deleteMutation.isPending}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
