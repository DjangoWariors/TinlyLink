import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Globe, CheckCircle, XCircle, Clock, 
  Trash2, RefreshCw, Copy, Shield
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Badge, Loading, EmptyState, Modal } from '@/components/common';
import { linksAPI, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { CustomDomain } from '@/types';

export function CustomDomainsPage() {
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<CustomDomain | null>(null);
  const [newDomain, setNewDomain] = useState('');

  const isPaidPlan = subscription?.plan !== 'free';
  const domainLimit = subscription?.limits.custom_domains || 0;

  // Fetch domains
  const { data: domains, isLoading } = useQuery({
    queryKey: ['customDomains'],
    queryFn: () => linksAPI.getDomains(),
    enabled: isPaidPlan,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (domain: string) => linksAPI.createDomain(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customDomains'] });
      toast.success('Domain added! Please configure DNS to verify.');
      setAddModalOpen(false);
      setNewDomain('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add domain');
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (id: string) => linksAPI.verifyDomain(id),
    onSuccess: (domain) => {
      queryClient.invalidateQueries({ queryKey: ['customDomains'] });
      if (domain.is_verified) {
        toast.success('Domain verified successfully!');
      } else {
        toast.error('DNS record not found. Please check your configuration.');
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'domain-verify' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => linksAPI.deleteDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customDomains'] });
      toast.success('Domain deleted');
      setDeleteModalOpen(false);
      setDomainToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete domain');
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getStatusBadge = (domain: CustomDomain) => {
    if (domain.is_verified) {
      return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>;
    }
    return <Badge variant="warning"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
  };

  const getSSLBadge = (domain: CustomDomain) => {
    if (!domain.is_verified) return null;
    switch (domain.ssl_status) {
      case 'active':
        return <Badge variant="success"><Shield className="w-3 h-3 mr-1" /> SSL Active</Badge>;
      case 'pending':
        return <Badge variant="warning"><Clock className="w-3 h-3 mr-1" /> SSL Pending</Badge>;
      case 'failed':
        return <Badge variant="danger"><XCircle className="w-3 h-3 mr-1" /> SSL Failed</Badge>;
      default:
        return null;
    }
  };

  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Domains</h1>
          <p className="text-gray-500 mt-1">Use your own branded domains for short links</p>
        </div>
        <Card>
          <EmptyState
            icon={<Globe className="w-6 h-6" />}
            title="Custom Domains Required"
            description="Custom domains are available on Pro and Business plans. Upgrade to use your own branded short links."
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
          <h1 className="text-2xl font-bold text-gray-900">Custom Domains</h1>
          <p className="text-gray-500 mt-1">
            Use your own branded domains for short links ({domains?.length || 0}/{domainLimit})
          </p>
        </div>
        <Button 
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setAddModalOpen(true)}
          disabled={(domains?.length || 0) >= domainLimit}
        >
          Add Domain
        </Button>
      </div>

      {/* Instructions */}
      <Card className="bg-primary-50 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary rounded-lg text-white">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">How to set up a custom domain</h3>
            <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
              <li>Add your domain below (e.g., link.yourcompany.com)</li>
              <li>Add the TXT record to your DNS settings for verification</li>
              <li>Add a CNAME record pointing to <code className="px-1 py-0.5 bg-white rounded text-xs">redirect.tinlylink.com</code></li>
              <li>Click verify once DNS is configured (may take up to 48 hours)</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Domains List */}
      <Card padding="none">
        {isLoading ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : !domains || domains.length === 0 ? (
          <EmptyState
            icon={<Globe className="w-6 h-6" />}
            title="No custom domains"
            description="Add your first custom domain to start using branded short links"
            action={
              <Button onClick={() => setAddModalOpen(true)}>
                Add Domain
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-200">
            {domains.map((domain: CustomDomain) => (
              <div key={domain.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{domain.domain}</h3>
                      {getStatusBadge(domain)}
                      {getSSLBadge(domain)}
                    </div>
                    
                    {!domain.is_verified && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                          Add this TXT record to your DNS:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 truncate">
                            {domain.dns_txt_record}
                          </code>
                          <button
                            onClick={() => handleCopy(domain.dns_txt_record)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-3">
                      Added {format(new Date(domain.created_at), 'MMM d, yyyy')}
                      {domain.verified_at && ` • Verified ${format(new Date(domain.verified_at), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!domain.is_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => verifyMutation.mutate(domain.id)}
                        isLoading={verifyMutation.isPending}
                        leftIcon={<RefreshCw className="w-4 h-4" />}
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDomainToDelete(domain);
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

      {/* Add Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setNewDomain('');
        }}
        title="Add Custom Domain"
      >
        <div className="space-y-4">
          <Input
            label="Domain"
            placeholder="link.yourcompany.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            hint="Enter the full subdomain you want to use (don't include https://)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newDomain)}
              isLoading={createMutation.isPending}
              disabled={!newDomain.trim()}
            >
              Add Domain
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDomainToDelete(null);
        }}
        title="Delete Domain"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{domainToDelete?.domain}</strong>? 
            Any links using this domain will revert to the default domain.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => domainToDelete && deleteMutation.mutate(domainToDelete.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Domain
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
