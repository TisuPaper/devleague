import React, { useState } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles } from 'lucide-react';
import './Chatbot.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hello! I am your FinAI assistant. I have analyzed the Q3 Financial Statement. What would you like to know?' }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const newMsg = { id: Date.now(), sender: 'user', text: inputValue };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    
    // Mock bot response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(), 
        sender: 'bot', 
        text: 'The 22% spike in OpEx was mainly driven by a $450k spend on the August enterprise marketing campaign, plus a $120k increase in AWS infrastructure costs.'
      }]);
    }, 1000);
  };

  return (
    <div className="chatbot glass-panel">
      <div className="chat-header">
        <div className="chat-title">
          <Bot size={18} className="bot-icon" />
          <h3>FinAI Assistant</h3>
        </div>
        <span className="online-indicator"></span>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.sender}`}>
            {msg.sender === 'bot' && <div className="avatar bot"><Sparkles size={12} /></div>}
            <div className="message-content">
              <p>{msg.text}</p>
            </div>
            {msg.sender === 'user' && <div className="avatar user"><User size={12} /></div>}
          </div>
        ))}
      </div>
      
      <div className="chat-input-area">
        <div className="suggested-prompts">
          <button className="prompt-chip">Explain OpEx Spike</button>
          <button className="prompt-chip">Revenue Breakdown</button>
        </div>
        <div className="input-wrapper">
          <input 
            type="text" 
            placeholder="Ask about this report..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
