interface SelectProps {
  value: string
  options: { value: string; label: string }[]
  onChange?: (value: string) => void
  className?: string
}

export const Select: React.FC<SelectProps> = ({ 
  value, 
  options, 
  onChange,
  className 
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`
        appearance-none w-full
        bg-white/5 border border-white/10 rounded-lg 
        px-3 py-1.5 text-xs text-white/90
        outline-none transition-all duration-200
        focus:border-zinc-500/50 focus:bg-white/10
        cursor-pointer
        ${className}
      `}
    >
      {options.map(option => (
        <option 
          key={option.value} 
          value={option.value}
          className="bg-zinc-900 text-white/90"
        >
          {option.label}
        </option>
      ))}
    </select>
    <div className="absolute right-2 top-1/2 -translate-y-1/2 
                    pointer-events-none text-white/30">
      ▼
    </div>
  </div>
)
