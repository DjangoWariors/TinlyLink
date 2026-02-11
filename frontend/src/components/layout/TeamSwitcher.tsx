/**
 * TeamSwitcher - Dropdown to switch between personal mode and teams
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { clsx } from 'clsx';
import { ChevronDown, Users, User, Plus, Settings, Check } from 'lucide-react';
import { useTeam } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';

export function TeamSwitcher() {
    const { subscription } = useAuth();
    const { currentTeam, myTeams, isTeamMode, switchTeam, isLoadingTeams } = useTeam();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const canCreateTeam = subscription?.plan === 'business' || subscription?.plan === 'enterprise';


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSwitch = async (slug: string | null) => {
        await switchTeam(slug);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    'hover:bg-gray-100 border border-gray-200',
                    isOpen && 'bg-gray-50'
                )}
            >
                <div
                    className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        isTeamMode ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                    )}
                >
                    {isTeamMode ? (
                        <Users className="w-4 h-4" />
                    ) : (
                        <User className="w-4 h-4" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                        {isTeamMode ? currentTeam?.name : 'Personal'}
                    </p>
                    <p className="text-xs text-gray-500">
                        {isTeamMode ? `${currentTeam?.member_count || 1} member${(currentTeam?.member_count || 1) > 1 ? 's' : ''}` : 'Solo mode'}
                    </p>
                </div>
                <ChevronDown
                    className={clsx(
                        'w-4 h-4 text-gray-400 transition-transform',
                        isOpen && 'transform rotate-180'
                    )}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {/* Personal workspace */}
                    <button
                        onClick={() => handleSwitch(null)}
                        className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                            'hover:bg-gray-50',
                            !isTeamMode && 'bg-primary/5'
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center">
                            <User className="w-4 h-4" />
                        </div>
                        <span className="flex-1 text-sm text-gray-900">Personal</span>
                        {!isTeamMode && <Check className="w-4 h-4 text-primary" />}
                    </button>

                    {/* Divider */}
                    {myTeams.length > 0 && <div className="border-t border-gray-100 my-1" />}

                    {/* Teams list */}
                    {isLoadingTeams ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Loading teams...</div>
                    ) : (
                        myTeams.map((team) => (
                            <button
                                key={team.team_id}
                                onClick={() => handleSwitch(team.team_slug)}
                                className={clsx(
                                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                                    'hover:bg-gray-50',
                                    currentTeam?.slug === team.team_slug && 'bg-primary/5'
                                )}
                            >
                                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                                    <Users className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900 truncate">{team.team_name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{team.role}</p>
                                </div>
                                {currentTeam?.slug === team.team_slug && (
                                    <Check className="w-4 h-4 text-primary" />
                                )}
                            </button>
                        ))
                    )}

                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1" />

                    {/* Actions */}
                    {canCreateTeam ? (
                        <Link
                            to="/dashboard/team-settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Team</span>
                        </Link>
                    ) : (
                        <Link
                            to="/dashboard/settings?tab=billing"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-primary hover:bg-primary/5"
                        >
                            <Users className="w-4 h-4" />
                            <span>Upgrade for Teams</span>
                        </Link>
                    )}

                    {isTeamMode && (
                        <Link
                            to="/dashboard/team-settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Settings className="w-4 h-4" />
                            <span>Team Settings</span>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
