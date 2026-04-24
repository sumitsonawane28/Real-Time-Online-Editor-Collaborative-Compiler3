import React from 'react';
import { Files, Search, Bot, Users, Bell, Settings, Play } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type ActivityTab = 'explorer' | 'search' | 'ai' | 'community' | 'notifications' | 'settings';

interface ActivityBarProps {
  activeTab: ActivityTab;
  setActiveTab: (tab: ActivityTab) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeTab, setActiveTab }) => {
  const topIcons = [
    { id: 'explorer' as ActivityTab, icon: Files, label: 'Explorer' },
    { id: 'search' as ActivityTab, icon: Search, label: 'Search' },
    { id: 'ai' as ActivityTab, icon: Bot, label: 'AI Assistant' },
    { id: 'community' as ActivityTab, icon: Users, label: 'Collaborators' },
  ];

  const bottomIcons = [
    { id: 'notifications' as ActivityTab, icon: Bell, label: 'Notifications' },
    { id: 'settings' as ActivityTab, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-12 bg-vscode-activity border-r border-vscode-border flex flex-col items-center py-3 shrink-0">
      <div className="flex-1 flex flex-col gap-5">
        {topIcons.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setActiveTab(id)}
            className={cn(
              'relative p-1.5 rounded transition-all',
              activeTab === id
                ? 'text-white bg-white/10 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-5 before:bg-white before:-left-1.5 before:rounded-r'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon size={22} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 pb-2">
        {bottomIcons.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setActiveTab(id)}
            className={cn(
              'p-1.5 rounded transition-all',
              activeTab === id
                ? 'text-white bg-white/10'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon size={22} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  );
};
