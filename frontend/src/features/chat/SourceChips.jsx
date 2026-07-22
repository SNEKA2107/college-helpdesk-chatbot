// AI Source Citations: shows the records that grounded an answer.
const ICON = {
  notice: '🔔', exam: '📘', attendance: '📊', fee: '💳',
  marks: '🎓', kb: '📖', faculty: '👤',
};

export default function SourceChips({ sources = [] }) {
  if (!sources.length) return null;
  return (
    <div className="source-chips">
      <span className="src-label">Sources</span>
      {sources.map((s, i) => (
        <span key={i} className="src-chip" title={s.label}>
          {ICON[s.type] || '📄'} {s.label}
        </span>
      ))}
    </div>
  );
}
