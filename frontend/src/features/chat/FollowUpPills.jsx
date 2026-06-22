// Smart follow-up suggestions generated alongside each answer.
export default function FollowUpPills({ suggestions = [], onPick }) {
  if (!suggestions.length) return null;
  return (
    <div className="followup-pills">
      {suggestions.map((q, i) => (
        <button key={i} className="followup-pill" onClick={() => onPick(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
