// src/components/ui/Toggle.tsx
interface ToggleProps {
    label?: string
    defaultChecked?: boolean
    onChange?: (checked: boolean) => void
    className?: string
  }
  
  export const Toggle: React.FC<ToggleProps> = ({ label, defaultChecked, onChange, className }) => (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        role="switch"
        aria-checked={defaultChecked}
        className={`
          relative w-10 h-5 rounded-full 
          transition-colors duration-200 ease-in-out
          ${defaultChecked ? 'bg-zinc-600' : 'bg-white/10'}
          hover:${defaultChecked ? 'bg-zinc-500' : 'bg-white/20'}
        `}
        onClick={() => onChange?.(!defaultChecked)}
      >
        <div
          className={`
            absolute top-0.5 left-0.5
            w-4 h-4 rounded-full bg-white
            transform transition-transform duration-200 ease-in-out
            ${defaultChecked ? 'translate-x-5' : 'translate-x-0'}
            shadow-sm
          `}
        />
      </button>
      {label && (
        <span className="text-xs text-white/70 select-none">
          {label}
        </span>
      )}
    </div>
  )