import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';

export type ChatMessage = {
  id: string;
  sender: 'me' | 'peer';
  text?: string;
  file?: { name: string; size: number; url: string; type: string };
  timestamp: number;
};

export type RecentContact = {
  peerId: string;
  lastMessageTimestamp: number;
  lastMessagePreview?: string;
};

export function useChatHistory(currentPeerId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecentContacts = useCallback(async () => {
    try {
      const contacts = await localforage.getItem<RecentContact[]>('recent_contacts');
      if (contacts) {
        setRecentContacts(contacts.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp));
      } else {
        setRecentContacts([]);
      }
    } catch (error) {
      console.error('Error loading recent contacts:', error);
    }
  }, []);

  const loadMessages = useCallback(async (peerId: string) => {
    setIsLoading(true);
    try {
      const history = await localforage.getItem<ChatMessage[]>(`chat_history_${peerId}`);
      if (history) {
        setMessages(history);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error(`Error loading history for peer ${peerId}:`, error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecentContacts();
  }, [loadRecentContacts]);

  useEffect(() => {
    if (currentPeerId) {
      loadMessages(currentPeerId);
    } else {
      setMessages([]);
      setIsLoading(false);
    }
  }, [currentPeerId, loadMessages]);

  const addMessage = useCallback(async (peerId: string, message: ChatMessage) => {
    try {
      const historyKey = `chat_history_${peerId}`;
      const currentHistory = (await localforage.getItem<ChatMessage[]>(historyKey)) || [];
      const updatedHistory = [...currentHistory, message];
      await localforage.setItem(historyKey, updatedHistory);
      
      setMessages(prev => {
        if (peerId === currentPeerId) {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        }
        return prev;
      });

      const contacts = (await localforage.getItem<RecentContact[]>('recent_contacts')) || [];
      const existingContactIndex = contacts.findIndex(c => c.peerId === peerId);
      
      let preview = '';
      if (message.text) {
        preview = message.text.substring(0, 50);
      } else if (message.file) {
        preview = `File: ${message.file.name}`;
      }

      const updatedContact: RecentContact = {
        peerId,
        lastMessageTimestamp: message.timestamp,
        lastMessagePreview: preview,
      };

      if (existingContactIndex >= 0) {
        contacts.splice(existingContactIndex, 1);
      }
      contacts.unshift(updatedContact);
      
      await localforage.setItem('recent_contacts', contacts);
      setRecentContacts(contacts);
      
    } catch (error) {
      console.error('Error adding message:', error);
    }
  }, [currentPeerId]);

  const clearHistory = useCallback(async (peerId: string) => {
    try {
      await localforage.removeItem(`chat_history_${peerId}`);
      
      if (peerId === currentPeerId) {
        setMessages([]);
      }

      const contacts = (await localforage.getItem<RecentContact[]>('recent_contacts')) || [];
      const updatedContacts = contacts.filter(c => c.peerId !== peerId);
      await localforage.setItem('recent_contacts', updatedContacts);
      setRecentContacts(updatedContacts);
      
    } catch (error) {
      console.error(`Error clearing history for peer ${peerId}:`, error);
    }
  }, [currentPeerId]);

  return {
    messages,
    recentContacts,
    isLoading,
    addMessage,
    clearHistory,
    loadMessages,
    loadRecentContacts
  };
}
