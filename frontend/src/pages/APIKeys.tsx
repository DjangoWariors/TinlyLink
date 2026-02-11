import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Key, Copy, Trash2, RefreshCw, 
  AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Badge, Loading, EmptyState, Modal, CopyButton } from '@/components/common';
import { accountAPI, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { APIKey } from '@/types';

export function APIKeysPage() {
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<APIKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [keyToRegenerate, setKeyToRegenerate] = useState<APIKey | null>(null);

  const isPaidPlan = subscription?.plan !== 'free';

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => accountAPI.getAPIKeys(),
    enabled: isPaidPlan,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => accountAPI.createAPIKey({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setNewKeyValue(data.key);
      setCreateModalOpen(false);
      setNewKeyModalOpen(true);
      setNewKeyName('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'apikey-create' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountAPI.deleteAPIKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key deleted', { id: 'apikey-delete' });
      setDeleteModalOpen(false);
      setKeyToDelete(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'apikey-delete' });
    },
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: (id: string) => accountAPI.regenerateAPIKey(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setNewKeyValue(data.key);
      setNewKeyModalOpen(true);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'apikey-regenerate' });
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!', { id: 'clipboard' });
  };

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key', { id: 'apikey-validation' });
      return;
    }
    createMutation.mutate(newKeyName);
  };

  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">Manage your API access keys</p>
        </div>
        <Card>
          <EmptyState
            icon={<Key className="w-6 h-6" />}
            title="API Access Required"
            description="API access is available on Pro and Business plans. Upgrade to get programmatic access to TinlyLink."
            action={
              <Button onClick={() => window.location.href = '/dashboard/settings?tab=billing'}>
                Upgrade Plan
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">Manage your API access keys for programmatic access</p>
        </div>
        <Button 
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalOpen(true)}
          disabled={(apiKeys?.length || 0) >= 5}
        >
          Create API Key
        </Button>
      </div>

      {/* API Documentation Link */}
      <Card className="bg-primary-50 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary rounded-lg text-white">
            <Key className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Getting Started with the API</h3>
            <p className="text-sm text-gray-600 mt-1">
              Use your API key to authenticate requests. Include it in the Authorization header as{' '}
              <code className="px-1 py-0.5 bg-white rounded text-xs">Bearer YOUR_API_KEY</code>
            </p>
            <a 
              href="/api" 
              className="inline-block mt-3 text-sm font-medium text-primary hover:text-primary-dark"
            >
              View API Documentation →
            </a>
          </div>
        </div>
      </Card>

      {/* API Keys List */}
      <Card padding="none">
        {isLoading ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <EmptyState
            icon={<Key className="w-6 h-6" />}
            title="No API keys"
            description="Create your first API key to get started with the API"
            action={
              <Button onClick={() => setCreateModalOpen(true)}>
                Create API Key
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((key: APIKey) => (
              <div key={key.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{key.name}</h3>
                      <Badge variant={key.is_active ? 'success' : 'danger'}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-600">
                        {key.key_prefix}{'•'.repeat(20)}
                      </code>
                      <CopyButton text={key.key_prefix} />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span>Created {format(new Date(key.created_at), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>
                        {key.last_used_at 
                          ? `Last used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`
                          : 'Never used'}
                      </span>
                      <span>•</span>
                      <span>{key.total_requests.toLocaleString()} requests</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setKeyToRegenerate(key);
                        setRegenerateModalOpen(true);
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setKeyToDelete(key);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Usage Info */}
      <Card className="bg-gray-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p>
              You can create up to <strong>5 API keys</strong>. Each key has a rate limit of{' '}
              <strong>{subscription?.plan === 'business' || subscription?.plan === 'enterprise' ? 'unlimited' : '1,000'}</strong> requests per month.
            </p>
            <p className="mt-2">
              API keys are shown only once when created. Store them securely - you won't be able to see the full key again.
            </p>
          </div>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewKeyName('');
        }}
        title="Create API Key"
      >
        <div className="space-y-4">
          <Input
            label="Key Name"
            placeholder="e.g., Production Server"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            hint="A descriptive name to help you identify this key"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createMutation.isPending}>
              Create Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Key Modal */}
      <Modal
        isOpen={newKeyModalOpen}
        onClose={() => {
          setNewKeyModalOpen(false);
          setNewKeyValue('');
          setShowKey(false);
        }}
        title="API Key Created"
      >
        <div className="space-y-4">
          <div className="p-4 bg-warning-bg rounded-lg">
            <p className="text-sm text-warning font-medium">
              ⚠️ Make sure to copy your API key now. You won't be able to see it again!
            </p>
          </div>
          <div>
            <label className="label">Your API Key</label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={newKeyValue}
                readOnly
                className="font-mono"
              />
              <Button
                variant="ghost"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <CopyButton text={newKeyValue}>Copy Key</CopyButton>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => {
              setNewKeyModalOpen(false);
              setNewKeyValue('');
              setShowKey(false);
            }}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Regenerate Confirmation Modal */}
      <Modal
        isOpen={regenerateModalOpen}
        onClose={() => {
          setRegenerateModalOpen(false);
          setKeyToRegenerate(null);
        }}
        title="Regenerate API Key"
      >
        <div className="space-y-4">
          <div className="p-4 bg-warning-bg rounded-lg">
            <p className="text-sm text-warning font-medium">
              Regenerating this key will invalidate the current key immediately. Any integrations using <strong>{keyToRegenerate?.name}</strong> will stop working until updated with the new key.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRegenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (keyToRegenerate) {
                  regenerateMutation.mutate(keyToRegenerate.id);
                  setRegenerateModalOpen(false);
                  setKeyToRegenerate(null);
                }
              }}
              isLoading={regenerateMutation.isPending}
            >
              Regenerate Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setKeyToDelete(null);
        }}
        title="Delete API Key"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{keyToDelete?.name}</strong>? 
            This action cannot be undone and any integrations using this key will stop working.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => keyToDelete && deleteMutation.mutate(keyToDelete.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
