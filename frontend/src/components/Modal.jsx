/** Shared modal matching the legacy .modal-overlay/.modal markup. */
export default function Modal({ open, onClose, title, subtitle, children, maxWidth }) {
  return (
    <div className={`modal-overlay${open ? ' show' : ''}`}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {title && <h3>{title}</h3>}
        {subtitle && <p className="sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
