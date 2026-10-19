import type { ReactNode } from 'react';

export function ToggleRow({ label, description, checked, onChange, icon }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-copy">
        {icon && <span className="toggle-icon">{icon}</span>}
        <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      </span>
      <input className="switch-input" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true"><span /></span>
    </label>
  );
}
