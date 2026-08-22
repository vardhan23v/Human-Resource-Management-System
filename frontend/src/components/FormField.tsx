import React, { useId } from 'react';

/** Label + input wrapper with consistent spacing, hint and inline error; forwards all input props. */
export default function FormField({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; required?: boolean; children: React.ReactElement }) {
  const id = useId();
  const child = React.cloneElement(children, { id, 'aria-invalid': !!error || undefined, 'aria-describedby': error || hint ? `${id}-desc` : undefined });
  return (
    <div>
      <label className="label" htmlFor={id}>{label}{required && <span aria-hidden="true" style={{ color: 'var(--danger)' }}> *</span>}</label>
      {child}
      {(error || hint) && <div id={`${id}-desc`} style={{ fontSize: 12, marginTop: 4, color: error ? 'var(--danger)' : 'var(--neutral-500)' }}>{error || hint}</div>}
    </div>
  );
}
