/**
 * Rule Groups Page - Manage rule groups for advanced conditional logic
 * Uses rulesAPI.groups.* methods (list, get, create, delete)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Trash2, Layers, ToggleLeft, ToggleRight,
    ArrowRight, ChevronRight, X
} from 'lucide-react';
import {
    Button, Input, Card, Badge, Modal, Loading, EmptyState
} from '@/components/common';
import { rulesAPI, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { RuleGroup } from '@/types';

export function RuleGroupsPage() {
    const queryClient = useQueryClient();
    const { subscription } = useAuth();
    const isPaidPlan = subscription?.plan && subscription.plan !== 'free';

    // State
    const [search, setSearch] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RuleGroup | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Create form state
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupLogic, setNewGroupLogic] = useState<'and' | 'or'>('and');

    // Fetch rule groups using groups.list
    const { data: groupsData, isLoading } = useQuery({
        queryKey: ['ruleGroups', search],
        queryFn: () => rulesAPI.groups.list({ search: search || undefined }),
    });

    // Get single group details using groups.get
    const { data: groupDetails, isLoading: detailsLoading } = useQuery({
        queryKey: ['ruleGroup', selectedGroup?.id],
        queryFn: () => rulesAPI.groups.get(selectedGroup!.id),
        enabled: !!selectedGroup,
    });

    // Create group mutation using groups.create
    const createMutation = useMutation({
        mutationFn: () => rulesAPI.groups.create({
            name: newGroupName,
            description: newGroupDescription,
            logic: newGroupLogic,
            is_active: true,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ruleGroups'] });
            toast.success('Rule group created');
            setCreateModalOpen(false);
            setNewGroupName('');
            setNewGroupDescription('');
            setNewGroupLogic('and');
        },
        onError: (error) => toast.error(getErrorMessage(error), { id: 'group-create' }),
    });

    // Delete group mutation using groups.delete
    const deleteMutation = useMutation({
        mutationFn: (id: string) => rulesAPI.groups.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ruleGroups'] });
            toast.success('Rule group deleted', { id: 'group-delete' });
            setSelectedGroup(null);
        },
        onError: (error) => toast.error(getErrorMessage(error), { id: 'group-delete' }),
    });

    const groups = groupsData?.results || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Rule Groups</h1>
                    <p className="text-gray-500 mt-1">
                        Combine multiple rules with AND/OR logic
                    </p>
                </div>
                <Button
                    onClick={() => setCreateModalOpen(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                    disabled={!isPaidPlan}
                >
                    Create Group
                </Button>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search groups..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Pro required alert */}
            {!isPaidPlan && (
                <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-primary" />
                        <div>
                            <p className="font-medium text-gray-900">Rule Groups are a Pro feature</p>
                            <p className="text-sm text-gray-500">Upgrade to combine rules with AND/OR logic</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Groups grid */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loading size="lg" />
                </div>
            ) : groups.length === 0 ? (
                <EmptyState
                    icon={<Layers className="w-12 h-12" />}
                    title="No rule groups yet"
                    description="Create groups to combine multiple rules with advanced logic"
                    action={
                        <Button
                            onClick={() => setCreateModalOpen(true)}
                            leftIcon={<Plus className="w-4 h-4" />}
                            disabled={!isPaidPlan}
                        >
                            Create First Group
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => (
                        <Card
                            key={group.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedGroup(group)}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-primary" />
                                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                                    </div>
                                    <Badge variant={group.is_active ? 'success' : 'default'}>
                                        {group.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>

                                {group.description && (
                                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                        {group.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <Badge variant={group.logic === 'and' ? 'primary' : 'warning'}>
                                        {group.logic.toUpperCase()} Logic
                                    </Badge>
                                    <span className="text-xs text-gray-400">
                                        {group.rules_count || 0} rules
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                title="Create Rule Group"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group Name
                        </label>
                        <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="e.g., Mobile Users Group"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <Input
                            value={newGroupDescription}
                            onChange={(e) => setNewGroupDescription(e.target.value)}
                            placeholder="Optional description..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Logic Type
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setNewGroupLogic('and')}
                                className={`flex-1 p-3 border-2 rounded-lg text-center transition-all ${newGroupLogic === 'and'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-semibold text-gray-900">AND</div>
                                <p className="text-xs text-gray-500 mt-1">All rules must match</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNewGroupLogic('or')}
                                className={`flex-1 p-3 border-2 rounded-lg text-center transition-all ${newGroupLogic === 'or'
                                        ? 'border-warning bg-warning/5'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="font-semibold text-gray-900">OR</div>
                                <p className="text-xs text-gray-500 mt-1">Any rule can match</p>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            isLoading={createMutation.isPending}
                            disabled={!newGroupName.trim()}
                        >
                            Create Group
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Group Details Modal */}
            <Modal
                isOpen={!!selectedGroup}
                onClose={() => setSelectedGroup(null)}
                title={selectedGroup?.name || 'Group Details'}
                size="lg"
            >
                {detailsLoading ? (
                    <div className="flex justify-center py-8">
                        <Loading />
                    </div>
                ) : groupDetails ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Badge variant={groupDetails.is_active ? 'success' : 'default'}>
                                    {groupDetails.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                                <Badge variant={groupDetails.logic === 'and' ? 'primary' : 'warning'}>
                                    {groupDetails.logic.toUpperCase()} Logic
                                </Badge>
                            </div>
                            <span className="text-sm text-gray-500">
                                {groupDetails.rules_count || 0} rules in group
                            </span>
                        </div>

                        {groupDetails.description && (
                            <p className="text-gray-600">{groupDetails.description}</p>
                        )}

                        <div className="pt-4 border-t">
                            <h4 className="font-medium text-gray-900 mb-3">Rules in Group</h4>
                            {groupDetails.rules && groupDetails.rules.length > 0 ? (
                                <div className="space-y-2">
                                    {groupDetails.rules.map((rule: any, index: number) => (
                                        <div key={rule.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                            <span className="text-sm font-medium text-gray-700">{rule.name}</span>
                                            {index < groupDetails.rules!.length - 1 && (
                                                <Badge variant={groupDetails.logic === 'and' ? 'primary' : 'warning'} className="text-xs">
                                                    {groupDetails.logic.toUpperCase()}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-4">
                                    No rules added to this group yet
                                </p>
                            )}
                        </div>

                        <div className="pt-4 border-t">
                            {confirmDeleteId === selectedGroup?.id ? (
                                <div className="flex items-center justify-between gap-3 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                                    <p className="text-sm text-danger">Are you sure? This cannot be undone.</p>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => deleteMutation.mutate(selectedGroup!.id)}
                                            isLoading={deleteMutation.isPending}
                                        >
                                            Confirm Delete
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between">
                                    <Button
                                        variant="danger"
                                        onClick={() => setConfirmDeleteId(selectedGroup!.id)}
                                        leftIcon={<Trash2 className="w-4 h-4" />}
                                    >
                                        Delete Group
                                    </Button>
                                    <Button onClick={() => setSelectedGroup(null)}>
                                        Close
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
