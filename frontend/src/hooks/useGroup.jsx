import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getActiveGroupSlug, setActiveGroupSlug } from '../lib/api';
import { useAuth } from './useAuth';

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const { user } = useAuth();
  // null = non ancora caricato, [] = caricato ma zero gruppi
  const [groups, setGroups] = useState(null);
  const [activeSlug, setActiveSlug] = useState(getActiveGroupSlug());

  const refresh = useCallback(async () => {
    if (!user) { setGroups(null); return []; }
    const mine = await api.myGroups();
    setGroups(mine);
    setActiveSlug(prev => {
      const stillValid = mine.some(g => g.slug === prev);
      const next = stillValid ? prev : (mine[0]?.slug || null);
      setActiveGroupSlug(next);
      return next;
    });
    return mine;
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const selectGroup = useCallback((slug) => {
    setActiveGroupSlug(slug);
    setActiveSlug(slug);
  }, []);

  const createGroup = useCallback(async (name) => {
    const group = await api.createGroup(name);
    await refresh();
    selectGroup(group.slug);
    return group;
  }, [refresh, selectGroup]);

  const joinGroup = useCallback(async (inviteCode) => {
    const group = await api.joinGroup(inviteCode);
    await refresh();
    selectGroup(group.slug);
    return group;
  }, [refresh, selectGroup]);

  const activeGroup = (groups || []).find(g => g.slug === activeSlug) || null;

  const value = useMemo(() => ({
    groups,
    activeGroup,
    loading: groups === null,
    selectGroup,
    createGroup,
    joinGroup,
    refresh,
  }), [groups, activeGroup, selectGroup, createGroup, joinGroup, refresh]);

  return createElement(GroupContext.Provider, { value }, children);
}

export function useGroup() {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup must be used inside GroupProvider');
  return value;
}
