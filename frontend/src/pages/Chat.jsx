import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { playSound } from '../utils/sound';
import { useChat } from '../features/chat/useChat';
import ConversationSidebar from '../features/chat/ConversationSidebar';
import SourceChips from '../features/chat/SourceChips';
import FollowUpPills from '../features/chat/FollowUpPills';
import '../styles/chat.css';

const WELCOME_HTML = `Hello! 👋 I'm <b>Campus HelpDesk</b>, your AI college assistant.<br><br>
I can help you with:<br>
📘 Exams &nbsp; 💳 Fees &nbsp; 🎓 Marks &nbsp; 📊 Attendance<br>
🔔 Notices &nbsp; 📅 Timetable &nbsp; 📝 Leave &nbsp; ☎ Contact<br><br>
Ask me anything — I'll answer from your own records and show you the sources.`;

const QUICK_TOPICS = [
  ['What are my exam dates?', '📘 Exams'],
  ['What is my fee balance?', '💳 Fees'],
  ['What is my attendance percentage?', '📊 Attendance'],
  ['What is my CGPA?', '🎓 Marks'],
  ['Show the latest notices', '🔔 Notices'],
  ['How do I apply for leave?', '📝 Leave'],
];

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

export default function Chat() {
  const {
    conversations, activeId, messages, typing, search,
    setSearch, send, openConversation, newChat, deleteConversation, rate,
  } = useChat();

  const [input, setInput] = useState('');
  const [tts, setTts] = useState(false);
  const bodyRef = useRef(null);
  const ttsRef = useRef(false);
  const spokenRef = useRef(0);
  ttsRef.current = tts;

  // Auto-scroll on new content.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Sound + optional TTS when a new assistant message arrives.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.id !== spokenRef.current) {
      spokenRef.current = last.id;
      playSound('bot');
      speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  function speak(text) {
    if (!ttsRef.current || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95; utt.pitch = 1; utt.lang = 'en-IN';
    window.speechSynthesis.speak(utt);
  }

  function submit(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setInput('');
    send(text);
  }

  function toggleTts() {
    setTts(v => {
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }

  const showWelcome = messages.length === 0 && !typing;

  return (
    <Layout title="Campus HelpDesk">
      <div className="chat-layout">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          search={search}
          onSearch={setSearch}
          onOpen={openConversation}
          onNew={() => { newChat(); spokenRef.current = 0; }}
          onDelete={deleteConversation}
        />

        <div className="chat-wrap">
          <div className="chat-head">
            <div className="bot-info">
              <div className="bot-avatar">🤖</div>
              <div>
                <div className="bot-name">Campus HelpDesk</div>
                <div className="bot-status"><span className="online-dot"></span> Online · grounded in your records</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={toggleTts}
                title="Text-to-speech"
                style={tts ? { borderColor: 'rgba(78,133,191,0.6)', color: '#89AACC' } : undefined}
              >{tts ? '🔊 Speak' : '🔇 Speak'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { newChat(); spokenRef.current = 0; }}>🗑 Clear</button>
            </div>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {showWelcome && (
              <div className="msg bot">
                <div className="msg-avatar">🤖</div>
                <div className="msg-wrap">
                  <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: WELCOME_HTML }}></div>
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`msg ${m.role === 'assistant' ? 'bot' : 'user'}`}>
                <div className="msg-avatar">{m.role === 'assistant' ? '🤖' : '👤'}</div>
                <div className="msg-wrap">
                  <div className="msg-bubble msg-text">{m.content}</div>
                  {m.role === 'assistant' && <SourceChips sources={m.sources} />}
                  {m.role === 'assistant' && <FollowUpPills suggestions={m.followUps} onPick={submit} />}
                  {m.role === 'assistant' && m.messageId && (
                    <div className="msg-feedback">
                      {m.feedback
                        ? <span className="fb-thanks">{m.feedback === 'up' ? '👍 Thanks for your feedback' : '👎 Thanks — we\'ll improve this'}</span>
                        : <>
                            <span className="fb-label">Was this helpful?</span>
                            <button className="fb-btn" title="Helpful" onClick={() => rate(m.id, m.messageId, 'up')}>👍</button>
                            <button className="fb-btn" title="Not helpful" onClick={() => rate(m.id, m.messageId, 'down')}>👎</button>
                          </>}
                    </div>
                  )}
                  <div className="msg-time">{m.time}</div>
                </div>
              </div>
            ))}

            <div className={`typing${typing ? ' show' : ''}`}>
              <div className="msg-avatar" style={{ background: 'linear-gradient(135deg,#89AACC,#4E85BF)' }}>🤖</div>
              <div style={{ background: '#161616', padding: '12px 16px', borderRadius: 14, borderBottomLeftRadius: 4, border: '1px solid #252525' }}>
                <div className="typing-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          </div>

          <div className="quick-btns">
            {QUICK_TOPICS.map(([prompt, label]) => (
              <button key={label} className="quick-btn" onClick={() => submit(prompt)}>{label}</button>
            ))}
          </div>

          <div className="chat-input-area">
            <input
              type="text" className="chat-input" placeholder="Ask Campus HelpDesk anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            />
            <button className="send-btn" onClick={() => submit()}>➤</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
