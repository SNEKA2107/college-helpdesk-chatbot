import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { playSound } from '../utils/sound';
import '../styles/chat.css';

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WELCOME_HTML = `Hello! 👋 I'm <b>CampusAssist Bot</b>, your smart college helpdesk assistant.<br><br>
I can help you with:<br>
📘 Exam Info &nbsp; 💳 Fees &nbsp; 📄 Marksheet<br>
📚 Library &nbsp; 📅 Timetable &nbsp; 📝 Leave<br>
🔔 Notices &nbsp; ☎ Contact Info<br><br>
Type <b>help</b> to see all topics or just ask your question!`;

const QUICK_TOPICS = [
  ['exam', '📘 Exam Info'], ['fees', '💳 Fees'], ['marksheet', '📄 Marksheet'],
  ['library', '📚 Library'], ['timetable', '📅 Timetable'], ['leave', '📝 Leave'],
  ['contact', '☎ Contact'], ['help', '💡 Help'],
];

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

export default function Chat() {
  const [messages, setMessages] = useState(() => [{ id: 0, type: 'bot', html: WELCOME_HTML, time: nowTime() }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [tts, setTts] = useState(false);
  const bodyRef = useRef(null);
  const idRef = useRef(0);
  const ttsRef = useRef(false);
  ttsRef.current = tts;

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  function speak(html) {
    if (!ttsRef.current || !window.speechSynthesis) return;
    const text = stripHtml(html);
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95; utt.pitch = 1; utt.lang = 'en-IN';
    window.speechSynthesis.speak(utt);
  }

  function addMsg(content, type) {
    const id = ++idRef.current;
    setMessages(m => [...m, { id, type, [type === 'bot' ? 'html' : 'text']: content, time: nowTime() }]);
    if (type === 'bot') { playSound('bot'); speak(content); }
  }

  async function sendMsg(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    addMsg(text, 'user');
    setInput('');
    setTyping(true);
    const result = await apiCall('/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
    setTyping(false);
    addMsg(result.ok ? result.data.message : "Sorry, I'm having trouble connecting right now. Please try again.", 'bot');
  }

  function clearChat() {
    setMessages([]);
    addMsg('Hello again! 👋 How can I help you today? Type <b>help</b> to see all topics.', 'bot');
  }

  function toggleTts() {
    setTts(v => {
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }

  return (
    <Layout title="Chat with Bot">
      <div className="chat-wrap">
        <div className="chat-head">
          <div className="bot-info">
            <div className="bot-avatar">🤖</div>
            <div>
              <div className="bot-name">CampusAssist Bot</div>
              <div className="bot-status"><span className="online-dot"></span> Online · Ready to help</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleTts}
              title="Text-to-speech"
              style={tts ? { borderColor: 'rgba(78,133,191,0.6)', color: '#89AACC' } : undefined}
            >{tts ? '🔊 Speak' : '🔇 Speak'}</button>
            <button className="btn btn-secondary btn-sm" onClick={clearChat}>🗑 Clear Chat</button>
          </div>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {messages.map(m => (
            <div key={m.id} className={`msg ${m.type}`}>
              <div className="msg-avatar" style={{
                background: m.type === 'bot' && m.id !== 0 ? 'linear-gradient(135deg,#4f46e5,#818cf8)' : undefined,
              }}>{m.type === 'bot' ? '🤖' : '👤'}</div>
              <div className="msg-wrap">
                {m.type === 'bot'
                  ? <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.html }}></div>
                  : <div className="msg-bubble">{m.text}</div>}
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
          {QUICK_TOPICS.map(([topic, label]) => (
            <button key={topic} className="quick-btn" onClick={() => sendMsg(topic)}>{label}</button>
          ))}
        </div>

        <div className="chat-input-area">
          <input
            type="text" className="chat-input" placeholder="Type your question…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMsg(); }}
          />
          <button className="send-btn" onClick={() => sendMsg()}>➤</button>
        </div>
      </div>
    </Layout>
  );
}
