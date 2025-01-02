import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Select } from './ui/Select'
import { Toggle } from './ui/Toggle'
import { SecureInput } from './ui/SecureInput'
import { store } from './store'

// Utility function for class names
const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(' ')

// Color button component
const ColorButton: React.FC<{ color: string; isSelected?: boolean }> = ({ 
  color, 
  isSelected 
}) => (
  <button
    className={cn(
      "w-6 h-6 rounded-full transition-all duration-200",
      `bg-${color}-500`,
      isSelected && "ring-2 ring-white ring-offset-2 ring-offset-black"
    )}
  />
)

// Back button component
export const BackButton: React.FC = () => (
  <button
    className="text-white/50 hover:text-white/90 transition-colors p-1.5 rounded-full"
    onClick={() => window.history.back()}
  >
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  </button>
)

// Privacy Settings Component
const PrivacySettings = () => (
  <div className="space-y-3 overflow-y-auto
                  scrollbar-thin scrollbar-track-white/5 
                  scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                  scrollbar-thumb-rounded">
    <SettingItem
      icon="🔒"
      title="Data Collection"
      description="Usage analytics"
    >
      <Toggle defaultChecked={false} />
    </SettingItem>
    <SettingItem
      icon="🛡️"
      title="Security"
      description="Authentication method"
    >
      <Select
        value="system"
        options={[
          { value: 'system', label: 'System Auth' },
          { value: 'password', label: 'Password' },
          { value: 'biometric', label: 'Biometric' }
        ]}
      />
    </SettingItem>
  </div>
)

// Shortcuts Settings Component
const ShortcutSettings = () => (
  <div className="space-y-3 overflow-y-auto
                  scrollbar-thin scrollbar-track-white/5 
                  scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                  scrollbar-thumb-rounded">
    <SettingItem
      icon="⌨️"
      title="Quick Access"
      description="Open menu"
    >
      <div className="text-xs text-white/70 bg-white/5 px-2 py-1 rounded">
        ⌘ + Space
      </div>
    </SettingItem>
    <SettingItem
      icon="🔍"
      title="Search"
      description="Quick search"
    >
      <div className="text-xs text-white/70 bg-white/5 px-2 py-1 rounded">
        ⌘ + K
      </div>
    </SettingItem>
  </div>
)

interface SettingsPanelProps {
  onClose: () => void
}

// Add interfaces for settings
interface Settings {
  general: {
    startupEnabled: boolean
    rememberPosition: boolean
    updateChannel: 'stable' | 'beta'
  }
  theme: {
    appearance: 'system' | 'light' | 'dark'
    accentColor: string
    animations: boolean
    blurEffects: boolean
  }
  ai: {
    model: string
    apiKey: string
    codeCompletion: boolean
    imageGeneration: boolean
    voiceCommands: boolean
  }
  privacy: {
    dataCollection: boolean
    authMethod: 'system' | 'password' | 'biometric'
  }
}

// Add settings state management
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<'general' | 'theme' | 'ai' | 'privacy' | 'shortcuts'>('general');
  const [settings, setSettings] = useState<Settings>({
    general: {
      startupEnabled: true,
      rememberPosition: false,
      updateChannel: 'stable'
    },
    theme: {
      appearance: 'system',
      accentColor: 'blue',
      animations: true,
      blurEffects: true
    },
    ai: {
      model: 'gpt4',
      apiKey: '',
      codeCompletion: true,
      imageGeneration: false,
      voiceCommands: false
    },
    privacy: {
      dataCollection: false,
      authMethod: 'system'
    }
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await store.get('settings');
      if (savedSettings) {
        setSettings(savedSettings as Settings);
      }
    };
    loadSettings();
  }, []);

  // Save settings on change
  const updateSettings = async (
    section: keyof Settings,
    key: string,
    value: any
  ) => {
    const newSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    };
    setSettings(newSettings);
    await store.set('settings', newSettings);
  };

  // Move GeneralSettings inside SettingsPanel
  const GeneralSettings = () => (
    <div className="space-y-2 overflow-y-auto
                    scrollbar-thin scrollbar-track-white/5 
                    scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                    scrollbar-thumb-rounded">
      <SettingItem
        icon="🚀"
        title="Startup"
        description="Launch automatically"
      >
        <Toggle 
          defaultChecked={settings.general.startupEnabled}
          onChange={(checked) => updateSettings('general', 'startupEnabled', checked)}
        />
      </SettingItem>

      <SettingItem
        icon="📍"
        title="Position"
        description="Remember window position"
      >
        <Toggle 
          defaultChecked={settings.general.rememberPosition}
          onChange={(checked) => updateSettings('general', 'rememberPosition', checked)}
        />
      </SettingItem>

      <SettingItem
        icon="🔄"
        title="Updates"
        description="Check automatically"
      >
        <Select
          value={settings.general.updateChannel}
          options={[
            { value: 'stable', label: 'Stable' },
            { value: 'beta', label: 'Beta' }
          ]}
          onChange={(value) => updateSettings('general', 'updateChannel', value)}
        />
      </SettingItem>
    </div>
  );

  // Similar updates for other sections...
  // Add handlers for theme, AI, and privacy settings
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0"
    >
      <div className="p-2 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="text-sm">⚙️</div>
            <span className="text-white/90 font-medium text-xs">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="relative group p-1.5 rounded-full"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-600 via-emerald-500 to-teal-400 
                           opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none"
            >
              <path 
                d="M19 12H5M12 19l-7-7 7-7" 
                strokeWidth="2.5"
                strokeLinecap="round" 
                strokeLinejoin="round"
                stroke="url(#backArrowGradient)"
              />
              <defs>
                <linearGradient id="backArrowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="50%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>
            </svg>
          </button>
        </div>

        {/* Settings Navigation */}
        <div className="flex h-[calc(100%-44px)]">
          <div className="w-20 border-r border-white/10 p-1.5 space-y-0.5">
            <NavButton
              icon="⚡"
              label="General"
              isActive={activeSection === 'general'}
              onClick={() => setActiveSection('general')}
            />
            <NavButton
              icon="🎨"
              label="Theme"
              isActive={activeSection === 'theme'}
              onClick={() => setActiveSection('theme')}
            />
            <NavButton
              icon="🤖"
              label="AI"
              isActive={activeSection === 'ai'}
              onClick={() => setActiveSection('ai')}
            />
            <NavButton
              icon="🔒"
              label="Privacy"
              isActive={activeSection === 'privacy'}
              onClick={() => setActiveSection('privacy')}
            />
            <NavButton
              icon="⌨️"
              label="Shortcuts"
              isActive={activeSection === 'shortcuts'}
              onClick={() => setActiveSection('shortcuts')}
            />
          </div>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto px-2 py-1
                        scrollbar-thin scrollbar-track-white/5 
                        scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                        scrollbar-thumb-rounded">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-2"
              >
                {activeSection === 'general' && <GeneralSettings />}
                {activeSection === 'theme' && <ThemeSettings />}
                {activeSection === 'ai' && <AISettings />}
                {activeSection === 'privacy' && <PrivacySettings />}
                {activeSection === 'shortcuts' && <ShortcutSettings />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Reusable components
const NavButton: React.FC<{
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full p-1.5 rounded-lg text-[11px] flex flex-col items-center gap-0.5",
      "transition-colors duration-200",
      isActive 
        ? "bg-white/10 text-white/90" 
        : "text-white/50 hover:text-white/70 hover:bg-white/5"
    )}
  >
    <span className="text-base">{icon}</span>
    <span>{label}</span>
  </button>
)

// Settings Section Components
const ThemeSettings = () => (
  <div className="space-y-2 overflow-y-auto
                  scrollbar-thin scrollbar-track-white/5 
                  scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                  scrollbar-thumb-rounded">
    <SettingItem
      icon="🌗"
      title="Appearance"
      description="Choose your theme"
    >
      <Select
        value="system"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' }
        ]}
      />
    </SettingItem>

    <SettingItem
      icon="🎨"
      title="Accent Color"
      description="Primary color theme"
    >
      <div className="flex gap-2">
        {['purple', 'blue', 'green', 'orange', 'pink'].map(color => (
          <ColorButton key={color} color={color} />
        ))}
      </div>
    </SettingItem>

    <SettingItem
      icon="✨"
      title="Effects"
      description="Visual effects"
    >
      <div className="space-y-2">
        <Toggle label="Animations" defaultChecked />
        <Toggle label="Blur Effects" defaultChecked />
      </div>
    </SettingItem>
  </div>
)

const AISettings = () => (
  <div className="space-y-2 overflow-y-auto
                  scrollbar-thin scrollbar-track-white/5 
                  scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
                  scrollbar-thumb-rounded">
    <SettingItem
      icon="🧠"
      title="AI Model"
      description="Select default model"
    >
      <Select
        value="gpt4"
        options={[
          { value: 'gpt4', label: 'GPT-4' },
          { value: 'claude', label: 'Claude' },
          { value: 'gemini', label: 'Gemini' }
        ]}
      />
    </SettingItem>

    <SettingItem
      icon="🔑"
      title="API Key"
      description="OpenAI API key"
    >
      <SecureInput placeholder="sk-..." />
    </SettingItem>

    <SettingItem
      icon="🎯"
      title="Features"
      description="Enable AI features"
    >
      <div className="space-y-2">
        <Toggle label="Code Completion" defaultChecked />
        <Toggle label="Image Generation" />
        <Toggle label="Voice Commands" />
      </div>
    </SettingItem>
  </div>
)

// Reusable Setting Item Component
const SettingItem: React.FC<{
  icon: string
  title: string
  description: string
  children: React.ReactNode
}> = ({ icon, title, description, children }) => (
  <div className="flex items-center justify-between p-1.5 rounded-lg
                  bg-white/5 hover:bg-white/10 transition-colors">
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <h3 className="text-xs font-medium text-white/90">{title}</h3>
        <p className="text-[10px] text-white/50">{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {children}
    </div>
  </div>
)