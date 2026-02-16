import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Trophy, FlaskConical, ExternalLink,
  TrendingUp, TrendingDown, Minus, Edit2
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge, Loading, EmptyState, Modal } from '@/components/common';
import { variantsAPI, getErrorMessage } from '@/services/api';
import type { Variant, CreateVariantData } from '@/types';
import toast from 'react-hot-toast';

interface ABTestingPanelProps {
  linkId: string;
}

export function ABTestingPanel({ linkId }: ABTestingPanelProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Variant | null>(null);
  const [winnerTarget, setWinnerTarget] = useState<Variant | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formWeight, setFormWeight] = useState(50);
  const [formIsControl, setFormIsControl] = useState(false);

  // Fetch variants
  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['variants', linkId],
    queryFn: () => variantsAPI.list(linkId),
    enabled: !!linkId,
  });

  // Fetch stats
  const { data: stats = [] } = useQuery({
    queryKey: ['variantStats', linkId],
    queryFn: () => variantsAPI.getStats(linkId),
    enabled: !!linkId && variants.length > 0,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateVariantData) => variantsAPI.create(linkId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', linkId] });
      queryClient.invalidateQueries({ queryKey: ['variantStats', linkId] });
      toast.success('Variant created');
      resetForm();
      setShowAddModal(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Variant> }) =>
      variantsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', linkId] });
      queryClient.invalidateQueries({ queryKey: ['variantStats', linkId] });
      toast.success('Variant updated');
      setEditingVariant(null);
      resetForm();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => variantsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', linkId] });
      queryClient.invalidateQueries({ queryKey: ['variantStats', linkId] });
      toast.success('Variant deleted');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Set winner mutation
  const setWinnerMutation = useMutation({
    mutationFn: (id: string) => variantsAPI.setWinner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', linkId] });
      queryClient.invalidateQueries({ queryKey: ['variantStats', linkId] });
      toast.success('Winner declared! Other variants have been deactivated.');
      setWinnerTarget(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Weight update (inline)
  const handleWeightChange = (variantId: string, weight: number) => {
    updateMutation.mutate({ id: variantId, data: { weight } });
  };

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormWeight(50);
    setFormIsControl(false);
  };

  const openEditModal = (variant: Variant) => {
    setEditingVariant(variant);
    setFormName(variant.name);
    setFormUrl(variant.destination_url);
    setFormWeight(variant.weight);
    setFormIsControl(variant.is_control);
    setShowAddModal(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formUrl.trim()) {
      toast.error('Name and destination URL are required');
      return;
    }

    if (editingVariant) {
      updateMutation.mutate({
        id: editingVariant.id,
        data: {
          name: formName,
          destination_url: formUrl,
          weight: formWeight,
        },
      });
    } else {
      createMutation.mutate({
        name: formName,
        destination_url: formUrl,
        weight: formWeight,
        is_control: formIsControl,
      });
    }
  };

  const getStatForVariant = (variantId: string) =>
    stats.find((s) => s.id === variantId);

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center py-12">
          <Loading />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variants Table */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-gray-400" />
            <CardTitle>A/B Test Variants</CardTitle>
            {variants.length > 0 && (
              <Badge variant="default">{variants.length} variants</Badge>
            )}
          </div>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetForm();
              setEditingVariant(null);
              setShowAddModal(true);
            }}
          >
            Add Variant
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={<FlaskConical className="w-10 h-10" />}
              title="No A/B test variants"
              description="Create variants to split traffic between different destination URLs and find what converts best."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Destination</th>
                  <th className="px-5 py-3 font-medium text-gray-500 w-40">Weight</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Impressions</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Clicks</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">CTR</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => {
                  const stat = getStatForVariant(variant.id);
                  return (
                    <tr key={variant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{variant.name}</span>
                          {variant.is_control && (
                            <Badge variant="warning">Control</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={variant.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate"
                          title={variant.destination_url}
                        >
                          {variant.destination_url}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={variant.weight}
                            onChange={(e) =>
                              handleWeightChange(variant.id, Number(e.target.value))
                            }
                            className="w-20 accent-primary"
                          />
                          <span className="text-xs font-medium text-gray-600 w-8 tabular-nums">
                            {variant.weight}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                        {variant.impressions.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                        {variant.clicks.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-gray-900">
                        {(variant.click_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-5 py-3">
                        {variant.is_winner ? (
                          <Badge variant="success">
                            <Trophy className="w-3 h-3 mr-1" /> Winner
                          </Badge>
                        ) : variant.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!variant.is_winner && variant.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setWinnerTarget(variant)}
                              title="Declare Winner"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(variant)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(variant)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Stats Panel */}
      {stats.length > 0 && (
        <Card padding="none">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <CardTitle>Test Results</CardTitle>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">Variant</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">CTR</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Conversions</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Conv. Rate</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Lift vs Control</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Significance</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.id} className="border-b border-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{stat.name}</span>
                        {stat.is_control && <Badge variant="warning">Control</Badge>}
                        {stat.is_winner && (
                          <Badge variant="success">
                            <Trophy className="w-3 h-3 mr-1" /> Winner
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {(stat.click_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {stat.conversions.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {(stat.conversion_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-right">
                      {stat.is_control ? (
                        <span className="text-gray-400">Baseline</span>
                      ) : stat.lift !== null ? (
                        <span
                          className={`flex items-center justify-end gap-1 font-medium ${
                            stat.lift > 0
                              ? 'text-green-600'
                              : stat.lift < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {stat.lift > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : stat.lift < 0 ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          {stat.lift > 0 ? '+' : ''}{stat.lift.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {stat.significance !== null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                stat.significance >= 95
                                  ? 'bg-green-500'
                                  : stat.significance >= 80
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${Math.min(stat.significance, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium tabular-nums ${
                              stat.significance >= 95
                                ? 'text-green-600'
                                : stat.significance >= 80
                                ? 'text-yellow-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {stat.significance}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Statistical significance above 95% indicates a reliable result. Declare a winner once significance is high enough.
            </p>
          </div>
        </Card>
      )}

      {/* Add / Edit Variant Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingVariant(null);
          resetForm();
        }}
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Version B - New headline"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination URL
            </label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/landing-page-b"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Traffic Weight: <span className="text-primary font-semibold">{formWeight}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={formWeight}
              onChange={(e) => setFormWeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {!editingVariant && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsControl}
                onChange={(e) => setFormIsControl(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Set as control variant (baseline for comparison)
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddModal(false);
                setEditingVariant(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingVariant ? 'Save Changes' : 'Create Variant'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Variant"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> This will permanently delete the variant and its data.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
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

      {/* Declare Winner Modal */}
      <Modal
        isOpen={!!winnerTarget}
        onClose={() => setWinnerTarget(null)}
        title="Declare Winner"
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Declaring a winner will deactivate all other variants.
              All traffic will be directed to the winning variant's URL.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Declare <strong>{winnerTarget?.name}</strong> as the winner?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setWinnerTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => winnerTarget && setWinnerMutation.mutate(winnerTarget.id)}
              isLoading={setWinnerMutation.isPending}
              leftIcon={<Trophy className="w-4 h-4" />}
            >
              Declare Winner
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
