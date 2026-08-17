import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getActiveGroupSlug, setActiveGroupSlug } from '../lib/api';
import { useAuth } from './useAuth';

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const { user, logout } = useAuth();
  // null = non ancora caricato, [] = caricato ma zero gruppi
  const [groups, setGroups] = useState(null);
  const [activeSlug, setActiveSlug] = useState(getActiveGroupSlug());

  const refresh = useCallback(async () => {
    if (!user) { setGroups(null); return []; }
    let mine;
    try {
      mine = await api.myGroups();
    } catch (err) {
      if (err?.status === 401) {
        // Token invalido per questo backend (es. residuo di un'altra sessione/app
        // sulla stessa origin, o sessione chiusa da un cambio password): non restare
        // bloccati su "Caricamento…", si torna al login così l'utente può riautenticarsi.
        console.error('token non valido, riporto al login', err);
        logout();
        return [];
      }
      // Errore transitorio (rete, 500, server in riavvio): non tocchiamo la sessione,
      // si riprova al prossimo refresh invece di sloggare l'utente per un blip.
      console.error('impossibile caricare i gruppi (riprovo più tardi)', err);
      return [];
    }
    setGroups(mine);
    setActiveSlug(prev => {
      const stillValid = mine.some(g => g.slug === prev);
      const next = stillValid ? prev : (mine[0]?.slug || null);
      setActiveGroupSlug(next);
      return next;
    });
    return mine;
  }, [user, logout]);

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
