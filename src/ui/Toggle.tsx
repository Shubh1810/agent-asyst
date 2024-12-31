// src/components/ui/Toggle.tsx
interface ToggleProps {
    label?: string
    defaultChecked?: boolean
    onChange?: (checked: boolean) => void
  }
  
  export const Toggle: React.FC<ToggleProps> = ({ label, defaultChecked, onChange }) => (
    <div className="flex items-center gap-2">
      <button
        role="switch"
        aria-checked={defaultChecked}
        className={`
          w-9 h-5 rounded-full p-0.5
          ${defaultChecked ? 'bg-purple-500' : 'bg-white/10'}
          transition-colors duration-200
        `}
        onClick={() => onChange?.(!defaultChecked)}
      >
        <div
          className={`
            w-4 h-4 rounded-full bg-white
            transform transition-transform duration-200
            ${defaultChecked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
      {label && <span className="text-xs text-white/70">{label}</span>}
    </div>
  )