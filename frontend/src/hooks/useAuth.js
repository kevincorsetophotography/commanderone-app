import { createContext, createElement, useContext, useMemo, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const getStoredUser = () => {
  const raw = localStorage.getItem('ct_user');

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('ct_user');
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return getStoredUser();
  });

  const login = async (username, password) => {
    const { token, user } = await api.login({ username, password });
    localStorage.setItem('ct_token', token);
    localStorage.setItem('ct_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (username, password) => {
    const { token, user } = await api.register({ username, password });
    localStorage.setItem('ct_token', token);
    localStorage.setItem('ct_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    localStorage.removeItem('ct_active_group');
    setUser(null);
  };

  const updateUser = (partialUser) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partialUser };
      localStorage.setItem('ct_user', JSON.stringify(updated));
      return updated;
    });
  };

  const value = useMemo(() => ({ user, login, register, logout, updateUser }), [user]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
