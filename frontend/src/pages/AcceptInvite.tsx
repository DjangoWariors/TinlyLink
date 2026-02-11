/**
 * AcceptInvite Page - Handles team invitation acceptance
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import { teamsAPI, setCurrentTeamSlug } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Loading } from '@/components/common';
import toast from 'react-hot-toast';
import type { InviteDetails } from '@/types';
import { Users, CheckCircle, XCircle, Shield, Edit3, Eye, LogIn, UserPlus } from 'lucide-react';

const roleInfo = {
    admin: {
        icon: Shield,
        permissions: ['Manage team members', 'Create and edit resources', 'View team analytics'],
    },
    editor: {
        icon: Edit3,
        permissions: ['Create and edit resources', 'View team analytics'],
    },
    viewer: {
        icon: Eye,
        permissions: ['View all team resources', 'View team analytics'],
    },
    owner: {
        icon: Shield,
        permissions: ['Full team control'],
    },
};

export function AcceptInvitePage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const { refreshTeams } = useTeam();

    const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Fetch invite details
    useEffect(() => {
        const fetchInvite = async () => {
            if (!token) {
                setError('Invalid invitation link');
                setIsLoading(false);
                return;
            }
            try {
                const details = await teamsAPI.getInviteDetails(token);
                setInviteDetails(details);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Invitation not found or has expired';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        if (!authLoading) {
            fetchInvite();
        }
    }, [token, authLoading]);

    // Handle accept invite
    const handleAccept = async () => {
        if (!token || !isAuthenticated) return;
        setIsAccepting(true);
        try {
            const result = await teamsAPI.acceptInvite(token);
            setSuccess(true);
            toast.success(`You've joined ${result.team.name}!`);
            await refreshTeams();
            setCurrentTeamSlug(result.team.slug);
            setTimeout(() => navigate('/dashboard'), 2000);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
            toast.error(errorMessage);
            setError(errorMessage);
        } finally {
            setIsAccepting(false);
        }
    };

    const role = inviteDetails?.role ? roleInfo[inviteDetails.role] : null;

    // Loading
    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loading size="lg" />
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <Card className="max-w-md w-full text-center">
                    <div className="py-6">
                        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-7 h-7 text-danger" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h1>
                        <p className="text-gray-500 mb-6">{error}</p>
                        <RouterLink to="/">
                            <Button>Go to Home</Button>
                        </RouterLink>
                    </div>
                </Card>
            </div>
        );
    }

    // Success
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <Card className="max-w-md w-full text-center">
                    <div className="py-6">
                        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-7 h-7 text-green-500" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900 mb-2">Welcome to the team!</h1>
                        <p className="text-gray-500">
                            You've successfully joined <strong>{inviteDetails?.team_name}</strong>.
                            Redirecting to dashboard...
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <Card className="max-w-md w-full text-center">
                    <div className="py-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                            <Users className="w-7 h-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Invitation</h1>
                        <p className="text-gray-500 mb-6">
                            You've been invited to join <strong>{inviteDetails?.team_name}</strong> as a{' '}
                            <span className="capitalize font-medium">{inviteDetails?.role}</span>.
                        </p>
                        <p className="text-sm text-gray-400 mb-6">
                            Please log in or create an account to accept this invitation.
                        </p>
                        <div className="space-y-3">
                            <RouterLink to={`/login?redirect=/invite/${token}`} className="block">
                                <Button className="w-full">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Log In
                                </Button>
                            </RouterLink>
                            <RouterLink to={`/register?redirect=/invite/${token}`} className="block">
                                <Button variant="outline" className="w-full">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Create Account
                                </Button>
                            </RouterLink>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // Authenticated - show accept
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <Card className="max-w-md w-full text-center">
                <div className="py-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                        <Users className="w-7 h-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Invitation</h1>
                    <p className="text-gray-500 mb-6">
                        <strong>{inviteDetails?.invited_by}</strong> has invited you to join{' '}
                        <strong>{inviteDetails?.team_name}</strong> as a{' '}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                            {inviteDetails?.role}
                        </span>
                    </p>

                    {role && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left border border-gray-100">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Role permissions</h3>
                            <ul className="space-y-2">
                                {role.permissions.map((perm) => (
                                    <li key={perm} className="flex items-center gap-2 text-sm text-gray-600">
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        {perm}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-3">
                        <Button onClick={handleAccept} isLoading={isAccepting} className="w-full">
                            Accept Invitation
                        </Button>
                        <RouterLink to="/dashboard" className="block">
                            <Button variant="ghost" className="w-full">Decline</Button>
                        </RouterLink>
                    </div>

                    <p className="text-xs text-gray-400 mt-5">
                        This invitation expires on{' '}
                        {inviteDetails?.expires_at ? new Date(inviteDetails.expires_at).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
            </Card>
        </div>
    );
}

export default AcceptInvitePage;
