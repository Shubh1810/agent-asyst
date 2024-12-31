interface SelectProps {
  value: string
  options: { value: string; label: string }[]
  onChange?: (value: string) => void
}

export const Select: React.FC<SelectProps> = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1
               text-xs text-white/90 outline-none
               focus:border-purple-500/50"
  >
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
)
