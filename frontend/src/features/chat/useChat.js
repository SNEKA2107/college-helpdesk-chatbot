import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCall } from '../../services/api';

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Campus HelpDesk state: conversation list (sidebar), the active transcript,
 * sending, resuming and searching. Persists to /api/chat + /api/conversations.
 */
export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [search, setSearch] = useState('');
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  const loadList = useCallback(async (q = '') => {
    const r = await apiCall(`/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (r.ok) setConversations(r.data.conversations || []);
  }, []);

  const openConversation = useCallback(async (id) => {
    const r = await apiCall(`/conversations/${id}`);
    if (r.ok) {
      setActiveId(id);
      setMessages((r.data.messages || []).map(m => ({
        id: nextId(),
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        followUps: m.followUps || [],
        messageId: m._id,
        feedback: m.feedback || null,
        time: nowTime(),
      })));
    }
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  const send = useCallback(async (rawText) => {
    const text = (rawText || '').trim();
    if (!text) return;
    setMessages(m => [...m, { id: nextId(), role: 'user', content: text, time: nowTime() }]);
    setTyping(true);
    const r = await apiCall('/chat', { method: 'POST', body: JSON.stringify({ message: text, conversationId: activeId }) });
    setTyping(false);
    if (r.ok) {
      setActiveId(r.data.conversationId);
      setMessages(m => [...m, {
        id: nextId(),
        role: 'assistant',
        content: r.data.message,
        sources: r.data.sources || [],
        followUps: r.data.followUps || [],
        messageId: r.data.messageId,
        feedback: null,
        time: nowTime(),
      }]);
      loadList(search);
    } else {
      setMessages(m => [...m, {
        id: nextId(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        sources: [], followUps: [], time: nowTime(),
      }]);
    }
  }, [activeId, loadList, search]);

  // Module 3: rate an assistant answer 👍/👎 (optimistic; reverts on failure).
  const rate = useCallback(async (localId, messageId, rating) => {
    if (!messageId) return;
    setMessages(ms => ms.map(m => (m.id === localId ? { ...m, feedback: rating } : m)));
    const r = await apiCall('/chat/feedback', { method: 'POST', body: JSON.stringify({ messageId, rating }) });
    if (!r.ok) setMessages(ms => ms.map(m => (m.id === localId ? { ...m, feedback: null } : m)));
  }, []);

  const deleteConversation = useCallback(async (id) => {
    await apiCall(`/conversations/${id}`, { method: 'DELETE' });
    if (id === activeId) newChat();
    loadList(search);
  }, [activeId, newChat, loadList, search]);

  // Debounced search-as-you-type over conversation history.
  useEffect(() => {
    const t = setTimeout(() => loadList(search), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, loadList]);

  return {
    conversations, activeId, messages, typing, search,
    setSearch, send, openConversation, newChat, deleteConversation, loadList, rate,
  };
}
