/**
 * TeamContext - Provides team state management across the application
 * Handles team switching, fetching teams, and role-based access
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { teamsAPI, getCurrentTeamSlug, setCurrentTeamSlug, clearCurrentTeamSlug } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Team, MyTeamEntry, TeamRole } from '@/types';

interface TeamContextType {
    // Current team state
    currentTeam: Team | null;
    currentTeamSlug: string | null;
    myRole: TeamRole | null;
    isTeamMode: boolean;

    // Teams list for switcher
    myTeams: MyTeamEntry[];
    isLoadingTeams: boolean;

    // Actions
    switchTeam: (slug: string | null) => Promise<void>;
    refreshTeams: () => Promise<void>;
    createTeam: (name: string, description?: string) => Promise<Team>;

    // Role helpers
    isOwner: boolean;
    isAdmin: boolean;
    canManage: boolean;
    canEdit: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

interface TeamProviderProps {
    children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
    const { user, isAuthenticated } = useAuth();

    // State
    const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
    const [currentTeamSlug, setCurrentTeamSlugState] = useState<string | null>(null);
    const [myTeams, setMyTeams] = useState<MyTeamEntry[]>([]);
    const [isLoadingTeams, setIsLoadingTeams] = useState(false);

    // Fetch teams list
    const refreshTeams = useCallback(async () => {
        if (!isAuthenticated) {
            setMyTeams([]);
            return;
        }

        setIsLoadingTeams(true);
        try {
            const teams = await teamsAPI.getMyTeams();
            setMyTeams(teams);
        } catch (error) {
            console.error('Failed to fetch teams:', error);
            setMyTeams([]);
        } finally {
            setIsLoadingTeams(false);
        }
    }, [isAuthenticated]);

    // Switch team
    const switchTeam = useCallback(async (slug: string | null) => {
        if (!slug) {
            // Switch to personal mode
            clearCurrentTeamSlug();
            setCurrentTeamSlugState(null);
            setCurrentTeam(null);
            return;
        }

        try {
            // Update localStorage first so API calls use new team
            setCurrentTeamSlug(slug);
            setCurrentTeamSlugState(slug);

            // Fetch full team details
            const teams = await teamsAPI.list();
            const team = teams.find(t => t.slug === slug);

            if (team) {
                setCurrentTeam(team);
            } else {
                // Team not found - clear
                clearCurrentTeamSlug();
                setCurrentTeamSlugState(null);
                setCurrentTeam(null);
            }
        } catch (error) {
            console.error('Failed to switch team:', error);
            toast.error('Failed to switch team. Returning to personal mode.');
            clearCurrentTeamSlug();
            setCurrentTeamSlugState(null);
            setCurrentTeam(null);
        }
    }, []);

    // Create team
    const createTeam = useCallback(async (name: string, description?: string): Promise<Team> => {
        const team = await teamsAPI.create({ name, description });
        await refreshTeams();
        return team;
    }, [refreshTeams]);

    // Initialize on auth change
    useEffect(() => {
        if (isAuthenticated) {
            refreshTeams();

            // Restore team from localStorage
            const savedSlug = getCurrentTeamSlug();
            if (savedSlug) {
                switchTeam(savedSlug);
            }
        } else {
            // Clear team state on logout
            setMyTeams([]);
            setCurrentTeam(null);
            setCurrentTeamSlugState(null);
        }
    }, [isAuthenticated, refreshTeams, switchTeam]);

    // Derive role from current team
    const myRole = useMemo((): TeamRole | null => {
        if (!currentTeam) return null;
        return currentTeam.my_role;
    }, [currentTeam]);

    // Role helper flags
    const isOwner = myRole === 'owner';
    const isAdmin = myRole === 'admin';
    const canManage = myRole === 'owner' || myRole === 'admin';
    const canEdit = myRole === 'owner' || myRole === 'admin' || myRole === 'editor';
    const isTeamMode = currentTeam !== null;

    const value: TeamContextType = {
        currentTeam,
        currentTeamSlug,
        myRole,
        isTeamMode,
        myTeams,
        isLoadingTeams,
        switchTeam,
        refreshTeams,
        createTeam,
        isOwner,
        isAdmin,
        canManage,
        canEdit,
    };

    return (
        <TeamContext.Provider value={value}>
            {children}
        </TeamContext.Provider>
    );
}

export function useTeam(): TeamContextType {
    const context = useContext(TeamContext);
    if (context === undefined) {
        throw new Error('useTeam must be used within a TeamProvider');
    }
    return context;
}

export default TeamContext;
