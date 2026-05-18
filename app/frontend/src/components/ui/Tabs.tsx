import { ReactNode, useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'underline' | 'pills';
  onChange?: (tabId: string) => void;
}

export default function Tabs({ tabs, defaultTab, variant = 'underline', onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[0.7rem] font-black uppercase tracking-widest transition-all duration-200 ${
                variant === 'underline'
                  ? `border-b-2 ${
                      isActive
                        ? 'border-accent text-text'
                        : 'border-transparent text-muted hover:text-text hover:border-border-glass'
                    }`
                  : `rounded-xl ${
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent/20 shadow-lg shadow-accent/5'
                        : 'text-muted hover:text-text hover:bg-panel border border-transparent'
                    }`
              }`}
            >
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="animate-fade-in">{activeContent}</div>
    </div>
  );
}
