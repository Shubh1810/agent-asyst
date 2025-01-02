interface SecureInputProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export const SecureInput: React.FC<SecureInputProps> = ({ 
  placeholder, 
  value, 
  onChange,
  className 
}) => (
  <div className="relative">
    <input
      type="password"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`
        w-full bg-white/5 border border-white/10 rounded-lg 
        px-3 py-1.5 text-xs text-white/90 
        placeholder:text-white/30
        outline-none transition-all duration-200
        focus:border-zinc-500/50 focus:bg-white/10
        ${className}
      `}
    />
  </div>
)
