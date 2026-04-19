'use client';

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  rows?: number;
}

export default function FormField({ label, name, type = 'text', value, onChange, placeholder, required, options, rows }: FormFieldProps) {
  const baseClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50";

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {options ? (
        <select id={name} name={name} value={value} onChange={onChange} required={required} className={baseClass}>
          <option value="" className="bg-[#1a1a2e]">Select...</option>
          {options.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows || 3} className={baseClass} />
      ) : (
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className={baseClass} />
      )}
    </div>
  );
}
