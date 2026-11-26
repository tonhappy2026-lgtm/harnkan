import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function NavBar({ title, left, right }: { title?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="navbar">
      <div className="navbar-row">
        <div className="navbar-left">{left}</div>
        <div className="navbar-title">{title}</div>
        <div className="navbar-right">{right}</div>
      </div>
    </header>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'plain' | 'destructive' | 'tinted' }

export function Button({ variant = 'plain', className = '', type = 'button', ...rest }: BtnProps) {
  const v = variant === 'plain' ? '' : `btn-${variant}`
  return <button type={type} className={`btn ${v} ${className}`.trim()} {...rest} />
}

export function Section({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {header && <div className="section-header">{header}</div>}
      <div className="list">{children}</div>
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  )
}

export function Cell({
  label,
  sub,
  value,
  onClick,
  accessory,
  leading,
}: {
  label: ReactNode
  sub?: ReactNode
  value?: ReactNode
  onClick?: () => void
  accessory?: ReactNode
  leading?: ReactNode
}) {
  const body = (
    <>
      {leading}
      <div className="cell-label">
        <div>{label}</div>
        {sub && <div className="cell-sub">{sub}</div>}
      </div>
      {value !== undefined && <div className="cell-value">{value}</div>}
      {accessory}
      {onClick && !accessory && <span className="chevron" aria-hidden>›</span>}
    </>
  )
  return onClick ? (
    <button type="button" className="cell" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="cell">{body}</div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {children}
      </div>
    </div>
  )
}
