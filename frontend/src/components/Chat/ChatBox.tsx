import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import type { HorizonScore } from '../../types';
import './ChatBox.css';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  currentScore: HorizonScore | null;
}

export function ChatBox({ isOpen, onClose, currentScore }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I can help you understand housing affordability scores and answer questions about the data. How can I assist you?',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userQuestion = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      // Automatically include current location score data if available
      const dataContext: Record<string, any> = {};
      if (currentScore) {
        // Send raw HorizonScore in JSON format
        dataContext.currentLocation = currentScore;
      }

      // Call AI API with prompt and context
      const answer = await api.askAI([userQuestion], dataContext);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: answer,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      // Fallback message on error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I encountered an error processing your question. Please try again, or check if the backend service is available.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      if (import.meta.env.DEV) {
        console.error('Chat AI error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <button className="chat-close-button" onClick={onClose} title="Close chat">
          ×
        </button>
      </div>
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.isUser ? 'user-message' : 'bot-message'}`}
          >
            <div className="message-content">
              {message.text}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message bot-message">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Type your message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button
          className="chat-send-button"
          onClick={handleSend}
          disabled={!inputText.trim() || isLoading}
          title="Send message"
        >
          →
        </button>
      </div>
    </div>
  );
}
