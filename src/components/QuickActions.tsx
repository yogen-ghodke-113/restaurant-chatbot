'use client';

import { QuickAction } from '@/types';

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction) => void;
}

export function QuickActions({ actions, onActionClick }: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  const getActionIcon = (text: string) => {
    if (text.toLowerCase().includes('menu') || text.toLowerCase().includes('order')) {
      return '🍽️';
    } else if (text.toLowerCase().includes('reddit')) {
      return '💬';
    } else if (text.toLowerCase().includes('compare') || text.toLowerCase().includes('vs')) {
      return '⚖️';
    } else if (text.toLowerCase().includes('expensive') || text.toLowerCase().includes('price')) {
      return '💰';
    } else {
      return '🔍';
    }
  };

  const getActionColor = (text: string) => {
    if (text.toLowerCase().includes('menu') || text.toLowerCase().includes('order')) {
      return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
    } else if (text.toLowerCase().includes('reddit')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    } else if (text.toLowerCase().includes('compare') || text.toLowerCase().includes('vs')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
    } else if (text.toLowerCase().includes('expensive') || text.toLowerCase().includes('price')) {
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
    } else {
      return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100';
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-600">Quick actions:</h4>
      
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => onActionClick(action)}
            className={`inline-flex items-center space-x-2 px-3 py-2.5 text-sm sm:text-sm font-medium border rounded-lg transition-colors min-h-[44px] ${getActionColor(action.text)}`}
          >
            <span className="text-base">{getActionIcon(action.text)}</span>
            <span className="truncate">{action.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
} 