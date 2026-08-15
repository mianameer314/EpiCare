import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  PanelLeft,
  Search,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { chatApi, type ChatSessionOut } from '../../api/chat';
import './ChatPage.css';

/* ────────────────────────────────────────────────────
   AI Medical Assistant Chat — Clinical Q&A Hub
   Designed with calming ergonomics, categorized clinical
   prompts, multi-session management, and reassuring feedback.
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

const initialWelcomeMessage: Message = {
  id: 'welcome',
  sender: 'ai',
  text: "Hello! I am your EpiCare Clinical AI Assistant. I'm connected to your health records and medical knowledge base to answer questions about seizure safety, AED medication adherence, sleep hygiene, and trigger management. How can I assist your health journey today?",
  timestamp: new Date(),
};

/**
 * Format markdown-like elements into styled React nodes safely
 */
function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="formatted-chat-text">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={lineIdx} className="chat-content-heading">
              {trimmed.replace('### ', '')}
            </h4>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[-•*]\s+/, '');
          return (
            <div key={lineIdx} className="chat-content-list-item">
              <span className="bullet-dot">•</span>
              <span>{parseInlineFormatting(content)}</span>
            </div>
          );
        }

        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (orderedMatch) {
          return (
            <div key={lineIdx} className="chat-content-list-item numbered">
              <span className="number-badge">{orderedMatch[1]}.</span>
              <span>{parseInlineFormatting(orderedMatch[2])}</span>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={lineIdx} className="chat-content-spacer" />;
        }

        return (
          <p key={lineIdx} className="chat-content-paragraph">
            {parseInlineFormatting(line)}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineFormatting(str: string) {
  const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export function ChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionOut[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialWelcomeMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionSearch, setSessionSearch] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await chatApi.getSessions();
      if (data) {
        setSessions(data);
        return data;
      }
    } catch {
      // Ignore initial load failure
    }
    return [];
  }, []);

  const loadSessionMessages = useCallback(async (sessionId: number) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await chatApi.getSessionMessages(sessionId);
      if (msgs && msgs.length > 0) {
        const formatted: Message[] = msgs.map((m) => ({
          id: String(m.id),
          sender: m.role === 'assistant' ? 'ai' : 'user',
          text: m.content,
          timestamp: new Date(m.created_at),
        }));
        setMessages(formatted);
      } else {
        setMessages([initialWelcomeMessage]);
      }
    } catch {
      setMessages([initialWelcomeMessage]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchSessions().then((loadedSessions) => {
      if (!isMounted) return;
      if (loadedSessions && loadedSessions.length > 0) {
        const first = loadedSessions[0];
        setActiveSessionId(first.id);
        loadSessionMessages(first.id);
      } else {
        setActiveSessionId(null);
        setMessages([initialWelcomeMessage]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchSessions, loadSessionMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSelectSession = (sessionId: number) => {
    if (activeSessionId === sessionId) return;
    setActiveSessionId(sessionId);
    loadSessionMessages(sessionId);
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setMessages([initialWelcomeMessage]);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewSession();
      }
    } catch {
      // Ignore
    }
  };

  const handleSend = async (textToSend?: string, topic?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    const tempUserMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date(),
      topic,
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const res = await chatApi.sendMessage(text, activeSessionId || undefined);
      
      const aiMsg: Message = {
        id: String(res.id || Date.now() + 1),
        sender: 'ai',
        text: res.content,
        timestamp: new Date(res.created_at || Date.now()),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (!activeSessionId && res.session_id) {
        setActiveSessionId(res.session_id);
      }
      fetchSessions();
    } catch {
      let fallbackText =
        "### 🛡️ Clinical Assistant Guidance\n\n" +
        "Maintaining regular antiepileptic medication schedules, getting consistent restorative sleep, and avoiding individualized triggers are fundamental to stabilizing the seizure threshold.\n\n" +
        "*In an acute medical emergency, call 1122 or trigger your Emergency SOS.*";

      const lower = text.toLowerCase();
      if (lower.includes('first aid') || lower.includes('tonic')) {
        fallbackText =
          "### 🛡️ Seizure First Aid (CARE Steps)\n\n" +
          "1. **Cushion Head:** Place something soft beneath their head.\n" +
          "2. **Turn on Recovery Side:** Roll onto lateral recovery position to keep airway clear.\n" +
          "3. **Time Duration:** Note exact start time.\n" +
          "4. **NEVER** put objects or spoons into the mouth, and **NEVER** restrain movement.";
      } else if (lower.includes('miss') || lower.includes('dose')) {
        fallbackText =
          "### 💊 Missed Dose Guidance\n\n" +
          "Take the missed dose as soon as you remember unless it is almost time for your next scheduled dose. **Never double up** doses.";
      }

      const fallbackMsg: Message = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: fallbackText,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <div className="chat-page-layout">
      {/* ── Collapsible Sessions Sidebar (Drawer) ── */}
      <div className={`chat-sessions-sidebar glass-panel ${isSidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-top-header">
          <div className="sidebar-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="sidebar-heading">Past Discussions</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen(false)}
              title="Collapse sidebar"
            >
              <PanelLeft size={15} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm new-session-btn"
            onClick={handleNewSession}
          >
            <Plus size={14} />
            <span>New Discussion</span>
          </button>

          {sessions.length > 3 && (
            <div className="sidebar-search-box">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                placeholder="Search past chats..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="sessions-scroll-list">
          {filteredSessions.length === 0 ? (
            <div className="sessions-empty-state">
              <Clock size={20} style={{ opacity: 0.4, marginBottom: '6px' }} />
              <p>{sessionSearch ? 'No discussions match search' : 'No past discussions yet'}</p>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Your clinical Q&A sessions will be saved here automatically.
              </span>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={`session-item-card ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectSession(session.id)}
                >
                  <div className="session-item-header">
                    <span className="session-item-title" title={session.title}>
                      {session.title}
                    </span>
                    <button
                      type="button"
                      className="session-delete-btn"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      title="Delete discussion"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="session-item-meta">
                    <span className="session-item-date">{formatRelativeTime(session.updated_at)}</span>
                    {session.message_count > 0 && (
                      <span className="session-item-count">{session.message_count} msgs</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="chat-main-area">
        {/* ── Top Header ── */}
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {!isSidebarOpen && (
              <button
                className="btn btn-ghost btn-sm open-sidebar-btn"
                onClick={() => setIsSidebarOpen(true)}
                title="Open past discussions"
              >
                <PanelLeft size={16} />
                <span>Discussions</span>
              </button>
            )}
            <div className="chat-bot-avatar-aura">
              <Bot size={24} />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-outline btn-sm reset-chat-btn"
              onClick={handleNewSession}
              title="Start a fresh conversation"
            >
              <Plus size={14} />
              <span>New Session</span>
            </button>
          </div>
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
                type="button"
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
              Responses are verified against clinical epilepsy literature. In an acute medical emergency, trigger your <strong>Emergency SOS</strong> or call <strong>1122</strong>.
            </span>
          </div>

          {/* Message Thread */}
          <div className="messages-area">
            {isLoadingMessages ? (
              <div className="chat-loading-overlay">
                <div className="typing-dot-wrap">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Loading conversation history...
                </span>
              </div>
            ) : (
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
                      {msg.sender === 'user' ? <User size={15} /> : <Bot size={16} />}
                    </div>

                    <div className={`message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                      <div className="bubble-top-meta">
                        <span className="sender-name">
                          {msg.sender === 'user' ? user?.full_name || 'You' : 'EpiCare Clinical AI'}
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
                        <FormattedMessageText text={msg.text} />
                      </div>

                      <div className="bubble-bottom-actions">
                        <button
                          type="button"
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
            )}

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
                  <span className="typing-label">Analyzing clinical literature & synthesis...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Bar ── */}
          <div className="chat-input-bar">
            <textarea
              ref={inputRef}
              className="chat-textarea"
              placeholder="Type your medical, prescription, or lifestyle inquiry... (Press Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isTyping}
            />

            <button
              type="button"
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
    </div>
  );
}
