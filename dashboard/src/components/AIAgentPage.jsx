import React, { useState, useRef, useEffect } from 'react';
import './AIAgentPage.css';

const SUGGESTED_PROMPTS = [
  'Summarise TechCorp Q3 issues',
  'Which clients have missing documents?',
  'Draft a follow-up for finstart.io',
  'Show report status overview',
];

const INITIAL_MESSAGES = [
  {
    id: 'm0',
    role: 'bot',
    text: 'Hello! I\'m your FinAI Shield assistant. I can help you summarise client statuses, draft emails, analyse financial patterns, or answer questions about any client in the portal.\n\nWhat would you like to know?',
  },
];

const BOT_REPLIES = {
  'summarise techcorp q3 issues': 'TechCorp Singapore currently has 2 open issues:\n\n1. **Cash Flow Statement missing** — Required for Liquidity Analysis. No follow-up sent yet.\n2. **Payroll Summary unreadable** — Password-protected Excel file. No follow-up sent yet.\n\nRecommendation: Send both follow-up emails to unblock the analysis.',
  'which clients have missing documents': 'Clients with missing or problematic documents:\n\n• **techcorp.com.sg** — 2 issues (1 missing, 1 format mismatch)\n• **globalfin.sg** — 1 issue (1 missing, follow-up sent)\n• **retailco.com.sg** — All 6 documents missing (newly onboarded)\n\nFinStart Capital is fully complete and ready for report approval.',
  'draft a follow-up for finstart.io': 'FinStart Capital has all 6 required documents and no issues. Their AI report is complete and awaiting your approval.\n\nNo follow-up email is needed — instead, consider reviewing and approving their report from the Analysis Workspace.',
  'show report status overview': 'Current report statuses:\n\n• FinStart Capital — ✅ Complete, awaiting approval\n• TechCorp Singapore — ⚠️ Partial (2 docs pending)\n• GlobalFin Partners — ⚠️ Partial (1 doc pending)\n• MerxBank Asia — ✅ Report sent to client\n• Retailco Holdings — ❌ Awaiting all documents',
};

const AIAgentPage = () => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = { id: `m${Date.now()}`, role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise(res => setTimeout(res, 900));

    const key = trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const reply = BOT_REPLIES[key] || `I've noted your question: "${trimmed}". In production this would query your AI backend with full document context. For now, try one of the suggested prompts above.`;

    const botMsg = { id: `m${Date.now() + 1}`, role: 'bot', text: reply };
    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="ai-agent-page">
      <div className="agent-layout">
        {/* Context sidebar */}
        <aside className="agent-context-panel">
          <div className="context-section">
            <h3 className="context-title">What I can do</h3>
            <ul className="context-list">
              <li>Summarise client document status</li>
              <li>Draft follow-up emails</li>
              <li>Identify cross-client patterns</li>
              <li>Answer questions about reports</li>
              <li>Suggest next actions</li>
            </ul>
          </div>
          <div className="context-section">
            <h3 className="context-title">Active Clients</h3>
            <ul className="context-client-list">
              {['techcorp.com.sg', 'finstart.io', 'globalfin.sg', 'merxbank.com', 'retailco.com.sg'].map(d => (
                <li key={d} className="context-client-item">
                  <span className="context-client-dot" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Chat */}
        <div className="agent-chat-panel">
          {/* Chat header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-status-dot" />
              <span className="chat-header-title">FinAI Shield Agent</span>
            </div>
            <span className="chat-model-tag">Powered by Gemini</span>
          </div>

          {/* Messages */}
          <div className="chat-messages" aria-live="polite" aria-label="Chat messages">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-bubble-wrapper ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="bot-avatar" aria-hidden="true">AI</div>
                )}
                <div className={`chat-bubble ${msg.role}`}>
                  <pre className="bubble-text">{msg.text}</pre>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble-wrapper bot">
                <div className="bot-avatar" aria-hidden="true">AI</div>
                <div className="chat-bubble bot typing-bubble">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          <div className="suggested-prompts">
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                id={`prompt-${p.slice(0, 20).replace(/\s/g, '-')}`}
                className="prompt-chip"
                onClick={() => sendMessage(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              id="agent-chat-input"
              className="chat-input"
              placeholder="Ask anything about clients, documents, or reports…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Chat input"
            />
            <button
              id="btn-send-chat"
              className="chat-send-btn btn-primary"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgentPage;
