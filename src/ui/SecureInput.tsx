interface SecureInputProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export const SecureInput: React.FC<SecureInputProps> = ({ placeholder, value, onChange }) => (
  <input
    type="password"
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1
               text-xs text-white/90 outline-none w-48
               focus:border-purple-500/50"
  />
)
