/**
 * Rules Page - Manage conditional redirect rules
 * Visual rule builder for smart link routing
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  Zap,
  Globe,
  Smartphone,
  Clock,
  MousePointer,
  ArrowRight,
  Shield,
  Tag,
  ChevronDown,
  Filter,
  RefreshCw,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/services/api';
import { Button, Input, Card, Badge, Modal, Dropdown, DropdownItem, EmptyState, Loading } from '@/components/common';
import { rulesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useDebounce } from '@/hooks';
import type { Rule, RuleConditionType, RuleActionType } from '@/types';

// Condition type labels and icons
const CONDITION_CONFIG: Record<RuleConditionType, { label: string; icon: typeof Globe; color: string }> = {
  country: { label: 'Country', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  city: { label: 'City', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  region: { label: 'Region', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  device: { label: 'Device', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  os: { label: 'OS', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  browser: { label: 'Browser', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  language: { label: 'Language', icon: Globe, color: 'bg-green-100 text-green-700' },
  referrer: { label: 'Referrer', icon: MousePointer, color: 'bg-orange-100 text-orange-700' },
  time: { label: 'Time', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  date: { label: 'Date', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  day_of_week: { label: 'Day of Week', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  scan_count: { label: 'Scan Count', icon: Zap, color: 'bg-pink-100 text-pink-700' },
  is_first_scan: { label: 'First Scan', icon: Zap, color: 'bg-pink-100 text-pink-700' },
  query_param: { label: 'Query Param', icon: Tag, color: 'bg-gray-100 text-gray-700' },
};

// Action type labels
const ACTION_CONFIG: Record<RuleActionType, { label: string; color: string }> = {
  redirect: { label: 'Redirect', color: 'bg-primary/10 text-primary' },
  block: { label: 'Block', color: 'bg-red-100 text-red-700' },
  add_utm: { label: 'Add UTM', color: 'bg-green-100 text-green-700' },
  show_content: { label: 'Show Content', color: 'bg-blue-100 text-blue-700' },
  set_header: { label: 'Set Header', color: 'bg-gray-100 text-gray-700' },
};

// Operator labels
const OPERATOR_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: 'not equals',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  between: 'between',
  in: 'in',
  not_in: 'not in',
  regex: 'matches regex',
};

export function RulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const { isTeamMode, canEdit } = useTeam();

  // State
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<RuleConditionType | ''>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const isPaidPlan = subscription?.plan !== 'free';

  // Fetch rules
  const { data: rulesData, isLoading, refetch } = useQuery({
    queryKey: ['rules', debouncedSearch, filterActive, filterType],
    queryFn: () => rulesAPI.list({
      search: debouncedSearch || undefined,
      is_active: filterActive ?? undefined,
      condition_type: filterType || undefined,
    }),
  });

  const rules = rulesData?.results || [];

  // Fetch rule stats using getStats API
  const { data: statsData } = useQuery({
    queryKey: ['ruleStats'],
    queryFn: () => rulesAPI.getStats({}),
    enabled: isPaidPlan,
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => rulesAPI.toggle(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success(data.is_active ? 'Rule activated' : 'Rule deactivated', { id: 'rule-toggle' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'rule-toggle' }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule deleted', { id: 'rule-delete' });
      setDeleteModalOpen(false);
      setRuleToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'rule-delete' }),
  });

  // Reorder mutation using reorder API
  const reorderMutation = useMutation({
    mutationFn: (newPriorities: Array<{ id: string; priority: number }>) => rulesAPI.reorder(newPriorities),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rules reordered', { id: 'rule-reorder' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'rule-reorder' }),
  });

  // Move rule up/down in priority
  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rules.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const newPriorities = rules.map((r, i) => {
      if (i === index) return { id: r.id, priority: rules[swapIndex].priority };
      if (i === swapIndex) return { id: r.id, priority: rules[index].priority };
      return { id: r.id, priority: r.priority };
    });
    reorderMutation.mutate(newPriorities);
  };

  const handleDelete = (rule: Rule) => {
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  };

  const formatConditionValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).slice(0, 30);
    }
    return String(value);
  };

  // Upgrade prompt for free users
  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Rules</h1>
            <p className="text-gray-500 mt-1">Create intelligent redirect rules</p>
          </div>
        </div>

        <Card className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Smart Rules allow you to redirect users based on their location, device, time, and more.
            Upgrade to Pro to unlock this powerful feature.
          </p>
          <Button onClick={() => navigate('/dashboard/settings?tab=billing')}>
            Upgrade Now
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Rules</h1>
          <p className="text-gray-500 mt-1">
            {rulesData?.count || 0} rule{(rulesData?.count || 0) !== 1 ? 's' : ''} total
          </p>
        </div>
        {(!isTeamMode || canEdit) && (
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/dashboard/rules/new')}
          >
            Create Rule
          </Button>
        )}
      </div>

      {/* Stats Dashboard using getStats */}
      {statsData && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-gray-900">Rule Performance</h3>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{statsData.total_rules || 0}</p>
                <p className="text-xs text-gray-500">Total Rules</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{(statsData.total_matches || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Matches</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{statsData.active_rules || 0}</p>
                <p className="text-xs text-gray-500">Active Rules</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">{((statsData as any).avg_matches_per_rule || 0).toFixed(1)}</p>
                <p className="text-xs text-gray-500">Avg Matches</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              {(filterActive !== null || filterType) && (
                <span className="ml-1 bg-white text-primary rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {(filterActive !== null ? 1 : 0) + (filterType ? 1 : 0)}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="input text-sm"
                value={filterActive === null ? '' : filterActive.toString()}
                onChange={(e) => setFilterActive(e.target.value === '' ? null : e.target.value === 'true')}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition Type</label>
              <select
                className="input text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as RuleConditionType | '')}
              >
                <option value="">All Types</option>
                {Object.entries(CONDITION_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            {(filterActive !== null || filterType) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterActive(null);
                    setFilterType('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Rules List */}
      {isLoading ? (
        <Card>
          <Loading />
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Zap className="w-6 h-6" />}
            title={search || filterActive !== null || filterType ? 'No rules found' : 'No rules yet'}
            description={
              search || filterActive !== null || filterType
                ? 'Try adjusting your search or filters'
                : 'Smart rules let you redirect users based on device, location, time, and more'
            }
            action={
              !search && filterActive === null && !filterType && (!isTeamMode || canEdit) ? (
                <Button
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => navigate('/dashboard/rules/new')}
                >
                  Create Rule
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const conditionConfig = CONDITION_CONFIG[rule.condition_type];
            const actionConfig = ACTION_CONFIG[rule.action_type];
            const ConditionIcon = conditionConfig?.icon || Zap;

            return (
              <Card
                key={rule.id}
                className={`transition-all duration-200 ${!rule.is_active ? 'opacity-60' : ''} hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  {/* Drag Handle & Priority + Move Buttons */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      onClick={() => handleMoveRule(rules.indexOf(rule), 'up')}
                      disabled={rules.indexOf(rule) === 0 || reorderMutation.isPending}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-gray-400 font-mono">#{rule.priority}</span>
                    <button
                      onClick={() => handleMoveRule(rules.indexOf(rule), 'down')}
                      disabled={rules.indexOf(rule) === rules.length - 1 || reorderMutation.isPending}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Rule Name & Target */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
                      {!rule.is_active && (
                        <Badge variant="default">Inactive</Badge>
                      )}
                      {rule.link_title && (
                        <Badge variant="primary" className="text-xs">
                          Link: {rule.link_title}
                        </Badge>
                      )}
                      {rule.qr_code_title && (
                        <Badge variant="primary" className="text-xs">
                          QR: {rule.qr_code_title}
                        </Badge>
                      )}
                      {rule.campaign_name && (
                        <Badge variant="primary" className="text-xs">
                          Campaign: {rule.campaign_name}
                        </Badge>
                      )}
                      {rule.serial_batch_name && (
                        <Badge variant="primary" className="text-xs">
                          Batch: {rule.serial_batch_name}
                        </Badge>
                      )}
                    </div>

                    {/* Rule Logic Visualization */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {/* Condition */}
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${conditionConfig?.color || 'bg-gray-100'}`}>
                        <ConditionIcon className="w-3.5 h-3.5" />
                        <span className="font-medium">{conditionConfig?.label || rule.condition_type}</span>
                      </div>

                      {/* Operator */}
                      <span className="text-gray-500 font-medium">
                        {OPERATOR_LABELS[rule.condition_operator] || rule.condition_operator}
                      </span>

                      {/* Value */}
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono text-xs">
                        {formatConditionValue(rule.condition_value)}
                      </code>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-gray-400" />

                      {/* Action */}
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${actionConfig?.color || 'bg-gray-100'}`}>
                        {rule.action_type === 'redirect' && <ArrowRight className="w-3.5 h-3.5" />}
                        {rule.action_type === 'block' && <Shield className="w-3.5 h-3.5" />}
                        {rule.action_type === 'add_utm' && <Tag className="w-3.5 h-3.5" />}
                        <span className="font-medium">{actionConfig?.label || rule.action_type}</span>
                      </div>
                    </div>

                    {/* Stats & Description */}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {rule.times_matched.toLocaleString()} matches
                      </span>
                      {rule.last_matched_at && (
                        <span>
                          Last matched {new Date(rule.last_matched_at).toLocaleDateString()}
                        </span>
                      )}
                      {rule.description && (
                        <span className="truncate max-w-xs">{rule.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate(rule.id)}
                      className={`p-2 rounded-lg transition-colors ${rule.is_active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-100'
                        }`}
                      title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    {(!isTeamMode || canEdit) && (
                      <Dropdown
                        trigger={
                          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        }
                        align="right"
                      >
                        <DropdownItem onClick={() => navigate(`/dashboard/rules/${rule.id}/edit`)}>
                          <Edit2 className="w-4 h-4" />
                          <span>Edit</span>
                        </DropdownItem>
                        <DropdownItem onClick={() => handleDelete(rule)} danger>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </DropdownItem>
                      </Dropdown>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Rule"
        size="sm"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete <strong>{ruleToDelete?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete.id)}
            isLoading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default RulesPage;
