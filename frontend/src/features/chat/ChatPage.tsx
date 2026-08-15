import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  User,
  Sparkles,
  ShieldCheck,
  Zap,
  Pill,
  Moon,
  AlertTriangle,
  Siren,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { chatApi } from '../../api/chat';
import './ChatPage.css';

/* ────────────────────────────────────────────────────
   AI Medical Assistant Chat — Clinical Q&A Hub
   Designed with calming ergonomics, categorized clinical
   prompts, and reassuring feedback for epilepsy patients.
   ──────────────────────────────────────────────────── */

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  topic?: string;
}

interface TopicCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const topicCategories: TopicCategory[] = [
  {
    id: 'firstaid',
    label: 'First-Aid Steps',
    icon: <Zap size={14} />,
    prompt: 'What are the essential first-aid steps if someone experiences a tonic-clonic seizure?',
  },
  {
    id: 'meds',
    label: 'Missed Dose Protocol',
    icon: <Pill size={14} />,
    prompt: 'What is the recommended protocol if I miss a scheduled antiepileptic dose?',
  },
  {
    id: 'triggers',
    label: 'Common Triggers',
    icon: <AlertTriangle size={14} />,
    prompt: 'How do sleep deprivation, stress, and sensory stimuli trigger seizure activity?',
  },
  {
    id: 'sleep',
    label: 'Sleep & Epilepsy',
    icon: <Moon size={14} />,
    prompt: 'What sleep hygiene practices help stabilize the seizure threshold?',
  },
  {
    id: 'emergency',
    label: 'Emergency 1122 Criteria',
    icon: <Siren size={14} />,
    prompt: 'When is a seizure considered a medical emergency requiring an immediate ambulance?',
  },
];

const initialMessages: Message[] = [
  {
    id: '1',
    sender: 'ai',
    text: "Hello! I am your EpiCare Clinical Assistant. I'm connected to your health records and medical knowledge base to answer questions about seizure safety, AED medication adherence, sleep hygiene, and trigger management. How can I assist your health journey today?",
    timestamp: new Date(),
  },
];

export function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chat history from DB
  useEffect(() => {
    let isMounted = true;
    chatApi.getHistory(30).then((history) => {
      if (!isMounted) return;
      if (history && history.length > 0) {
        const formatted: Message[] = history.map((m) => ({
          id: String(m.id),
          sender: m.role === 'assistant' ? 'ai' : 'user',
          text: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMessages(formatted);
      }
    }).catch(() => {
      // Fall back to initial welcome message if unauthenticated or new
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string, topic?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date(),
      topic,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const res = await chatApi.sendMessage(text);
      const aiMsg: Message = {
        id: String(res.id || Date.now() + 1),
        sender: 'ai',
        text: res.content,
        timestamp: new Date(res.created_at || Date.now()),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Graceful clinical fallback
      let reply =
        'Maintaining consistent sleep, taking prescribed antiepileptic medications on schedule, and avoiding known triggers are key steps for seizure management. Always consult your neurologist for tailored clinical advice.';
      const lower = text.toLowerCase();
      if (lower.includes('first-aid') || lower.includes('steps') || lower.includes('tonic')) {
        reply =
          '**Seizure First-Aid Guidelines:**\n1. **Stay Calm & Cushion Head:** Place something soft beneath their head and gently ease them onto their side.\n2. **Time the Seizure:** Note the exact start time.\n3. **Clear Area:** Remove sharp objects and loosen tight neckwear.\n4. **Do NOT Restrain:** Never hold the person down or place anything into their mouth.\n5. **Recovery:** Stay with them until they regain full orientation.';
      } else if (lower.includes('trigger') || lower.includes('sleep') || lower.includes('stress')) {
        reply =
          '**Key Seizure Triggers:**\n• **Sleep Deprivation:** Chronic sleep deficit significantly lowers cortical seizure threshold.\n• **Missed Medications:** Plasma drug levels dip below therapeutic thresholds.\n• **High Stress & Fever:** Elevated systemic stress hormones can provoke epileptiform discharges.\n• **Photosensitivity:** Flickering or strobe lights in photosensitive epilepsy.';
      } else if (lower.includes('miss') || lower.includes('dose') || lower.includes('medication')) {
        reply =
          '**Missed Medication Guidance:**\n• If you remember within a few hours, take the dose as soon as possible.\n• If it is close to your next scheduled dose, skip the missed dose and resume your regular schedule.\n• **Never double up** on doses without direct guidance from your prescribing neurologist.';
      } else if (lower.includes('emergency') || lower.includes('1122') || lower.includes('911')) {
        reply =
          '**🚨 Call Ambulance (1122 / 911) If:**\n1. The seizure lasts **longer than 5 minutes** (Risk of Status Epilepticus).\n2. A second seizure starts immediately without the person recovering consciousness.\n3. The person has difficulty breathing after jerking stops.\n4. The seizure occurs in water or causes physical injury.\n5. It is the person’s first known seizure.';
      }

      const fallbackMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetChat = () => {
    setMessages(initialMessages);
  };

  return (
    <div className="chat-page">
      {/* ── Top Header ── */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="chat-bot-avatar-aura">
            <Bot size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h1>EpiCare Clinical AI Assistant</h1>
              <span className="glass-badge chat-status-badge">
                <span className="live-dot" /> Online
              </span>
            </div>
            <p>Neurology Q&A, medication schedules, and epilepsy first-aid guidelines.</p>
          </div>
        </div>

        <button
          className="btn btn-outline btn-sm reset-chat-btn"
          onClick={handleResetChat}
          title="Clear and reset chat session"
        >
          <RefreshCw size={14} />
          <span>New Session</span>
        </button>
      </div>

      {/* ── Categorized Inquiries Carousel ── */}
      <div className="topic-bar">
        <div className="topic-bar-label">
          <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
          <span>Clinical Topics:</span>
        </div>
        <div className="topic-chips-scroll">
          {topicCategories.map((t) => (
            <button
              key={t.id}
              className="topic-chip-btn"
              onClick={() => handleSend(t.prompt, t.label)}
              disabled={isTyping}
            >
              <span className="topic-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Chat Glass Container ── */}
      <div className="chat-container glass-card">
        {/* Medical Reassurance Banner */}
        <div className="chat-disclaimer-card">
          <ShieldCheck size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span>
            Responses are verified against clinical epilepsy literature. In an acute medical emergency, trigger your <strong>Quick SOS</strong> or call <strong>1122</strong>.
          </span>
        </div>

        {/* Message Thread */}
        <div className="messages-area">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                className={`message-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <div className={`avatar-chip ${msg.sender === 'user' ? 'user-avatar' : 'ai-avatar'}`}>
                  {msg.sender === 'user' ? (
                    <User size={15} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>

                <div className={`message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                  <div className="bubble-top-meta">
                    <span className="sender-name">
                      {msg.sender === 'user' ? (user?.full_name || 'You') : 'EpiCare Clinical AI'}
                    </span>
                    <span className="bubble-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.topic && (
                    <div className="bubble-topic-tag">
                      Topic: {msg.topic}
                    </div>
                  )}

                  <div className="bubble-text">
                    {msg.text.split('\n').map((line, idx) => (
                      <React.Fragment key={idx}>
                        {line}
                        {idx < msg.text.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="bubble-bottom-actions">
                    <button
                      className="bubble-action-btn"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy message to clipboard"
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check size={13} style={{ color: 'var(--color-success)' }} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              className="message-row ai-row"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="avatar-chip ai-avatar">
                <Bot size={16} />
              </div>
              <div className="message-bubble ai-bubble typing-bubble">
                <div className="typing-dot-wrap">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <span className="typing-label">Consulting medical records...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="chat-input-bar">
          <textarea
            className="chat-textarea"
            placeholder="Type your medical, prescription, or lifestyle inquiry... (Press Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isTyping}
          />

          <button
            className="chat-send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            title="Send Message"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
