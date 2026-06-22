// Persistent chat history: searchable list of past conversations + new chat.
export default function ConversationSidebar({
  conversations, activeId, search, onSearch, onOpen, onNew, onDelete,
}) {
  return (
    <aside className="convo-sidebar">
      <button className="convo-new" onClick={onNew}>＋ New chat</button>
      <div className="convo-search">
        <input
          type="text"
          placeholder="🔍 Search chats…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <div className="convo-list">
        {conversations.length === 0 && (
          <div className="convo-empty">{search ? 'No matches' : 'No conversations yet'}</div>
        )}
        {conversations.map(c => (
          <div
            key={c._id}
            className={`convo-item${c._id === activeId ? ' active' : ''}`}
            onClick={() => onOpen(c._id)}
          >
            <span className="convo-title">{c.title || 'Untitled chat'}</span>
            <button
              className="convo-del"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDelete(c._id); }}
            >✕</button>
          </div>
        ))}
      </div>
    </aside>
  );
}
