import { Plus, X } from 'lucide-react';

const inputClass =
  'w-full glass-input rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-momentum-ember/40';
const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-momentum-flare ml-1">*</span> : null}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${inputClass} resize-y min-h-[6rem]`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function MultiSelectChips({
  values,
  onChange,
  options,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: readonly string[];
}) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize border transition-colors ${
              selected
                ? 'bg-momentum-ember/20 border-momentum-ember/40 text-momentum-flare'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            {opt.replace(/-/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}

export function UrlListInput({
  values,
  onChange,
  placeholder = 'https://',
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const updateAt = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const addRow = () => onChange([...values, '']);
  const removeRow = (index: number) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => updateAt(index, e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
          {values.length > 1 ? (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Remove link"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-sm text-momentum-flare hover:text-white"
      >
        <Plus className="h-4 w-4" />
        Add link
      </button>
    </div>
  );
}

export function TextListInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const updateAt = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const addRow = () => onChange([...values, '']);
  const removeRow = (index: number) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => updateAt(index, e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
          {values.length > 1 ? (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Remove item"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-sm text-momentum-flare hover:text-white"
      >
        <Plus className="h-4 w-4" />
        Add item
      </button>
    </div>
  );
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function cleanUrlList(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0 && isValidUrl(v));
}

export function cleanTextList(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
}
