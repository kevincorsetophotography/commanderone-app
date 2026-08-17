const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getToken = () => localStorage.getItem('ct_token');

export const getActiveGroupSlug = () => localStorage.getItem('ct_active_group') || null;
export const setActiveGroupSlug = (slug) => {
  if (slug) localStorage.setItem('ct_active_group', slug);
  else localStorage.removeItem('ct_active_group');
};

const parseResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  return text ? { error: text } : null;
};

const req = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await parseResponse(res);

  if (!res.ok) {
    throw payload || { error: 'Errore di rete' };
  }

  return payload;
};

// Richiesta scoped al gruppo attivo — usa la slug corrente al momento della chiamata
// (non quella "congelata" al render), così cambiare gruppo aggiorna subito le chiamate successive.
const reqG = (method, path, body) => {
  const slug = getActiveGroupSlug();
  if (!slug) return Promise.reject({ error: 'Nessun gruppo selezionato' });
  return req(method, `/groups/${slug}${path}`, body);
};

export const api = {
  // auth
  register:      (data) => req('POST',  '/auth/register', data),
  login:         (data) => req('POST',  '/auth/login', data),
  updateProfile: (data) => req('PATCH', '/auth/profile', data),

  // gruppi (creazione/adesione, non scoped a un gruppo specifico)
  myGroups:            () => req('GET',  '/groups/mine'),
  createGroup:  (name) => req('POST', '/groups', { name }),
  joinGroup:    (inviteCode) => req('POST', '/groups/join', { inviteCode }),
  regenerateInviteCode: (slug) => req('POST', `/groups/${slug}/invite-code/regenerate`),

  // admin (del gruppo attivo)
  adminMembers:  () => reqG('GET', '/admin/members'),
  updateMember:  (userId, data) => reqG('PATCH', `/admin/members/${userId}`, data),
  removeMember:  (userId) => reqG('DELETE', `/admin/members/${userId}`),
  exportData:    () => reqG('GET', '/admin/export'),

  // decks
  getDecks:    ()     => reqG('GET',    '/decks'),
  getMyDecks:  ()     => reqG('GET',    '/decks/mine'),
  getDeck:     (id)   => reqG('GET',    `/decks/${id}`),
  createDeck:  (data) => reqG('POST',   '/decks', data),
  updateDeck:  (id, data) => reqG('PATCH', `/decks/${id}`, data),
  deleteDeck:  (id)   => reqG('DELETE', `/decks/${id}`),
  importDeck:  (url)  => reqG('POST',   '/decks/import', { url }),

  // games
  getGames:       ()     => reqG('GET', '/games'), // array completo, invariato (usato per stat aggregate lato client)
  getGamesPage:   (page, pageSize = 20) => reqG('GET', `/games?page=${page}&pageSize=${pageSize}`), // { games, total, page, pageSize, totalPages }
  getGame:    (id)   => reqG('GET',    `/games/${id}`),
  createGame: (data) => reqG('POST',   '/games', data),
  updateGame: (id, data) => reqG('PATCH', `/games/${id}`, data),
  deleteGame: (id)   => reqG('DELETE', `/games/${id}`),

  // commenti & reazioni
  getComments:    (gameId)            => reqG('GET',    `/games/${gameId}/comments`),
  addComment:     (gameId, body)      => reqG('POST',   `/games/${gameId}/comments`, { body }),
  deleteComment:  (gameId, commentId) => reqG('DELETE', `/games/${gameId}/comments/${commentId}`),
  toggleReaction: (gameId, emoji)     => reqG('POST',   `/games/${gameId}/reactions`, { emoji }),

  // notifiche
  getNotifications:      ()  => reqG('GET',  '/notifications'),
  getUnreadCount:        ()  => reqG('GET',  '/notifications/unread-count'),
  markNotificationsRead: ()  => reqG('POST', '/notifications/read'),

  // eventi (calendario / tornei)
  getEvents:    ()         => reqG('GET',    '/events'),
  getEvent:     (id)       => reqG('GET',    `/events/${id}`),
  createEvent:  (data)     => reqG('POST',   '/events', data),
  updateEvent:  (id, data) => reqG('PATCH',  `/events/${id}`, data),
  deleteEvent:  (id)       => reqG('DELETE', `/events/${id}`),
  toggleRsvp:   (id)       => reqG('POST',   `/events/${id}/rsvp`),
  generateRound: (id)            => reqG('POST',   `/events/${id}/rounds`),
  deleteRound:   (id, roundId)   => reqG('DELETE', `/events/${id}/rounds/${roundId}`),
  submitTableResult: (id, tableId, data) => reqG('POST', `/events/${id}/tables/${tableId}/result`, data),

  // judge bot
  askJudge: (question) => reqG('POST', '/judge', { question }),
  getJudgeHistory: () => reqG('GET', '/judge'),

  // stats
  statsPlayers:  () => reqG('GET', '/stats/players'),
  statsDecks:    () => reqG('GET', '/stats/decks'),
  statsMatchups: () => reqG('GET', '/stats/matchups'),
  playerAchievements: (userId) => reqG('GET', `/stats/achievements/${userId}`),
};
