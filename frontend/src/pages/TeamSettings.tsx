/**
 * TeamSettings Page - Manage team settings, members, and invites
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTeam } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';
import { teamsAPI, getErrorMessage } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Modal, Loading, Badge, ProgressBar } from '@/components/common';
import toast from 'react-hot-toast';
import type { TeamMember, TeamInvite } from '@/types';
import { clsx } from 'clsx';
import {
    Users,
    Mail,
    Settings,
    Crown,
    Shield,
    Edit3,
    Eye,
    Trash2,
    UserPlus,
    AlertTriangle,
    Clock,
    Calendar,
} from 'lucide-react';

type Tab = 'members' | 'invites' | 'settings';

const roleConfig = {
    owner:  { icon: Crown,  color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Owner' },
    admin:  { icon: Shield, color: 'text-purple-600 bg-purple-50 border-purple-200', label: 'Admin' },
    editor: { icon: Edit3,  color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Editor' },
    viewer: { icon: Eye,    color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Viewer' },
};

export function TeamSettingsPage() {
    const navigate = useNavigate();
    const { subscription } = useAuth();
    const { currentTeam, isOwner, canManage, refreshTeams, createTeam } = useTeam();

    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create team modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDescription, setNewTeamDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Invite modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
    const [isInviting, setIsInviting] = useState(false);

    // Remove member modal
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    // Settings tab
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const canCreateTeam = subscription?.plan === 'business' || subscription?.plan === 'enterprise';
    const teamMemberLimit = subscription?.limits?.team_members ?? 0;
    const pendingInvites = invites.filter(i => i.status === 'pending');

    // Fetch members and invites
    useEffect(() => {
        const fetchData = async () => {
            if (!currentTeam) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const [membersData, invitesData] = await Promise.all([
                    teamsAPI.listMembers(currentTeam.id),
                    canManage ? teamsAPI.listInvites(currentTeam.id) : Promise.resolve([]),
                ]);
                setMembers(membersData);
                setInvites(invitesData);
            } catch {
                toast.error('Failed to load team data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentTeam, canManage]);

    // Init settings fields from current team
    useEffect(() => {
        if (currentTeam) {
            setTeamName(currentTeam.name);
            setTeamDescription(currentTeam.description || '');
        }
    }, [currentTeam]);

    // Create team
    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            toast.error('Team name is required');
            return;
        }
        setIsCreating(true);
        try {
            const team = await createTeam(newTeamName.trim(), newTeamDescription.trim());
            toast.success(`Team "${team.name}" created!`);
            setShowCreateModal(false);
            setNewTeamName('');
            setNewTeamDescription('');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsCreating(false);
        }
    };

    // Send invite
    const handleSendInvite = async () => {
        if (!currentTeam || !inviteEmail.trim()) {
            toast.error('Email is required');
            return;
        }
        setIsInviting(true);
        try {
            const invite = await teamsAPI.sendInvite(currentTeam.id, {
                email: inviteEmail.trim(),
                role: inviteRole,
            });
            setInvites([invite, ...invites]);
            toast.success(`Invitation sent to ${inviteEmail}`);
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteRole('editor');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsInviting(false);
        }
    };

    // Update member role
    const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
        if (!currentTeam) return;
        try {
            await teamsAPI.updateMemberRole(currentTeam.id, memberId, { role: newRole });
            setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
            toast.success('Role updated');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    // Remove member
    const handleRemoveMember = (memberId: string, memberName: string) => {
        setMemberToRemove({ id: memberId, name: memberName });
        setShowRemoveModal(true);
    };

    const confirmRemoveMember = async () => {
        if (!currentTeam || !memberToRemove) return;
        setIsRemoving(true);
        try {
            await teamsAPI.removeMember(currentTeam.id, memberToRemove.id);
            setMembers(members.filter(m => m.id !== memberToRemove.id));
            toast.success('Member removed');
            setShowRemoveModal(false);
            setMemberToRemove(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsRemoving(false);
        }
    };

    // Revoke invite
    const handleRevokeInvite = async (inviteId: string) => {
        if (!currentTeam) return;
        try {
            await teamsAPI.revokeInvite(currentTeam.id, inviteId);
            setInvites(invites.filter(i => i.id !== inviteId));
            toast.success('Invitation revoked');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    // Save team settings
    const handleSaveSettings = async () => {
        if (!currentTeam || !teamName.trim()) return;
        setIsSaving(true);
        try {
            await teamsAPI.update(currentTeam.id, {
                name: teamName.trim(),
                description: teamDescription.trim(),
            });
            await refreshTeams();
            toast.success('Team settings saved');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    // Delete team
    const handleDeleteTeam = async () => {
        if (!currentTeam) return;
        setIsDeleting(true);
        try {
            await teamsAPI.delete(currentTeam.id);
            await refreshTeams();
            toast.success('Team deleted');
            setShowDeleteModal(false);
            navigate('/dashboard');
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsDeleting(false);
        }
    };

    const settingsChanged = currentTeam && (
        teamName.trim() !== currentTeam.name ||
        teamDescription.trim() !== (currentTeam.description || '')
    );

    // ── No team selected ──────────────────────────────────────────────
    if (!currentTeam) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4">
                <Card className="text-center">
                    <div className="py-8">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                            <Users className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Collaboration</h1>
                        {canCreateTeam ? (
                            <>
                                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                    Create a team to collaborate with your colleagues on links, QR codes, and campaigns.
                                </p>
                                <Button onClick={() => setShowCreateModal(true)}>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Create Team
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                                    Team collaboration is available on the Business plan. Upgrade to start collaborating.
                                </p>
                                <Button onClick={() => navigate('/dashboard/settings?tab=billing')}>
                                    <Crown className="w-4 h-4 mr-2" />
                                    Upgrade to Business
                                </Button>
                            </>
                        )}
                    </div>
                </Card>

                {/* Create Team Modal */}
                <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Team">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                            <Input
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="e.g. Marketing Team"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                            <textarea
                                value={newTeamDescription}
                                onChange={(e) => setNewTeamDescription(e.target.value)}
                                placeholder="What does this team work on?"
                                rows={3}
                                className="input"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateTeam} isLoading={isCreating}>Create Team</Button>
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    // ── Main team settings page ───────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{currentTeam.name}</h1>
                    <p className="text-gray-500 mt-0.5">{currentTeam.description || 'Team settings and member management'}</p>
                </div>
                {canManage && (
                    <Button onClick={() => setShowInviteModal(true)} size="sm">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                    </Button>
                )}
            </div>

            {/* Member count bar */}
            {teamMemberLimit > 0 && (
                <Card padding="sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">Team Members</span>
                        <span className="text-sm text-gray-500">
                            {members.length} / {teamMemberLimit === -1 ? '∞' : teamMemberLimit}
                        </span>
                    </div>
                    <ProgressBar
                        value={members.length}
                        max={teamMemberLimit === -1 ? 100 : teamMemberLimit}
                        size="sm"
                    />
                </Card>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
                {([
                    { id: 'members' as Tab, label: 'Members', icon: Users, count: members.length, show: true },
                    { id: 'invites' as Tab, label: 'Invites', icon: Mail, count: pendingInvites.length, show: canManage },
                    { id: 'settings' as Tab, label: 'Settings', icon: Settings, count: null, show: isOwner },
                ]).filter(t => t.show).map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== null && (
                                <span className={clsx(
                                    'text-xs px-1.5 py-0.5 rounded-full',
                                    activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loading size="lg" />
                </div>
            ) : (
                <>
                    {/* ── Members Tab ───────────────────────────────────── */}
                    {activeTab === 'members' && (
                        <Card padding="none">
                            <div className="divide-y divide-gray-100">
                                {members.map((member) => {
                                    const role = roleConfig[member.role];
                                    const Icon = role.icon;
                                    return (
                                        <div key={member.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {member.user.avatar_url ? (
                                                    <img src={member.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                                        {member.user.initials || member.user.email[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {member.user.full_name || member.user.email}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">{member.user.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className={clsx(
                                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                                                    role.color
                                                )}>
                                                    <Icon className="w-3 h-3" />
                                                    {role.label}
                                                </span>
                                                {canManage && member.role !== 'owner' && (
                                                    <div className="flex items-center gap-1.5">
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => handleUpdateRole(member.id, e.target.value as 'admin' | 'editor' | 'viewer')}
                                                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white hover:border-gray-300 focus:ring-1 focus:ring-primary focus:border-primary transition-colors cursor-pointer"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="editor">Editor</option>
                                                            <option value="viewer">Viewer</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleRemoveMember(member.id, member.user.full_name || member.user.email)}
                                                            className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                                                            title="Remove member"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {members.length === 0 && (
                                    <div className="py-12 text-center text-gray-500">
                                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                        <p className="text-sm">No members yet</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* ── Invites Tab ──────────────────────────────────── */}
                    {activeTab === 'invites' && canManage && (
                        <Card padding="none">
                            {pendingInvites.length === 0 ? (
                                <div className="py-12 text-center text-gray-500">
                                    <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm font-medium mb-1">No pending invitations</p>
                                    <p className="text-xs text-gray-400">Invite team members to start collaborating</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {pendingInvites.map((invite) => (
                                        <div key={invite.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <Badge variant="default" className="text-xs capitalize">{invite.role}</Badge>
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        by {invite.invited_by_name}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRevokeInvite(invite.id)}
                                                className="text-gray-400 hover:text-danger"
                                            >
                                                Revoke
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* ── Settings Tab ─────────────────────────────────── */}
                    {activeTab === 'settings' && isOwner && (
                        <div className="space-y-6">
                            {/* General settings */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>General</CardTitle>
                                    <CardDescription>Update your team's name and description</CardDescription>
                                </CardHeader>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                                        <Input
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            placeholder="Team name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            value={teamDescription}
                                            onChange={(e) => setTeamDescription(e.target.value)}
                                            placeholder="What does this team work on?"
                                            rows={3}
                                            className="input"
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button onClick={handleSaveSettings} isLoading={isSaving} disabled={!settingsChanged}>
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {/* Team info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Team Information</CardTitle>
                                </CardHeader>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <Crown className="w-5 h-5 text-yellow-500" />
                                        <div>
                                            <p className="text-xs text-gray-500">Owner</p>
                                            <p className="text-sm font-medium text-gray-900">{currentTeam.owner_email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Created</p>
                                            <p className="text-sm font-medium text-gray-900">
                                                {new Date(currentTeam.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Danger zone */}
                            <Card className="border-danger/30">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-danger" />
                                        <CardTitle className="text-danger">Danger Zone</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Deleting the team removes all team associations from resources. This cannot be undone.
                                    </CardDescription>
                                </CardHeader>
                                <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Team
                                </Button>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {/* ── Remove Member Modal ────────────────────────────────────── */}
            <Modal isOpen={showRemoveModal} onClose={() => { setShowRemoveModal(false); setMemberToRemove(null); }} title="Remove Team Member" size="sm">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-danger/5 rounded-lg border border-danger/20">
                        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700">
                            Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from the team? They will lose access to all team resources immediately.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => { setShowRemoveModal(false); setMemberToRemove(null); }}>Cancel</Button>
                        <Button variant="danger" onClick={confirmRemoveMember} isLoading={isRemoving}>
                            Remove Member
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Invite Modal ─────────────────────────────────────────── */}
            <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Team Member">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                            className="input"
                        >
                            <option value="admin">Admin — Full management access</option>
                            <option value="editor">Editor — Create and edit resources</option>
                            <option value="viewer">Viewer — Read-only access</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                        <Button onClick={handleSendInvite} isLoading={isInviting}>
                            <Mail className="w-4 h-4 mr-2" />
                            Send Invite
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Delete Confirmation Modal ─────────────────────────────── */}
            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Team" size="sm">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-danger/5 rounded-lg border border-danger/20">
                        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-danger">
                            <p className="font-medium">This action is permanent</p>
                            <p className="mt-1 text-danger/80">
                                All team associations will be removed from links, QR codes, and campaigns. Member access will be revoked immediately.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteTeam} isLoading={isDeleting}>
                            Delete Team
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default TeamSettingsPage;
