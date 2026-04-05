// CZSKTiers Web Auth Module
// Handles login via Firebase Auth, registration via bot tunnel
(function () {
  const AUTH_KEY = 'czsktiers_auth';

  // Check for token in URL hash (redirect from bot registration page)
  function checkHashToken() {
    const hash = location.hash;
    if (hash.startsWith('#auth=')) {
      try {
        const data = JSON.parse(decodeURIComponent(hash.slice(6)));
        if (data.token && data.nick) {
          setAuth(data);
          if (data.apiUrl) localStorage.setItem('czsktiers_api_url', data.apiUrl);
          history.replaceState(null, '', location.pathname + location.search);
          return true;
        }
      } catch {}
    }
    return false;
  }

  function getAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function setAuth(data) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
  }

  function isLoggedIn() {
    return !!getAuth()?.nick;
  }

  function getCurrentUser() {
    return getAuth();
  }

  // Firebase login — works directly from GitHub Pages, no tunnel needed
  async function login(nick, password) {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase není načteno. Zkus obnovit stránku.');
    }
    const email = nick.trim().toLowerCase() + '@czsktiers.web';
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = cred.user;
      const displayNick = user.displayName || nick.trim();
      const idToken = await user.getIdToken();
      setAuth({ token: idToken, nick: displayNick, discordId: user.uid, firebase: true });
      return { token: idToken, nick: displayNick, discordId: user.uid };
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Neplatný nick nebo heslo.');
      }
      throw new Error(err.message || 'Přihlášení selhalo.');
    }
  }

  // Registration still goes through bot tunnel API
  async function register(code, password) {
    const apiUrl = localStorage.getItem('czsktiers_api_url') || '';
    const res = await fetch(apiUrl + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Nastala chyba');
    setAuth({ token: data.token, nick: data.nick, discordId: data.discordId });
    return data;
  }

  function logout() {
    clearAuth();
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(() => {});
    }
    window.location.reload();
  }

  async function changePassword(oldPassword, newPassword) {
    // Change via bot API (if tunnel available)
    const apiUrl = localStorage.getItem('czsktiers_api_url') || '';
    const auth = getAuth();
    if (!auth?.token) throw new Error('Nejsi přihlášen');
    const res = await fetch(apiUrl + '/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Nastala chyba');
    return data;
  }

  // Inject login button into header
  function injectLoginButton() {
    const header = document.querySelector('.main-header');
    if (!header) return;

    const container = document.createElement('div');
    container.className = 'header-auth';

    const auth = getAuth();
    if (auth?.nick) {
      const inKitsDir = location.pathname.includes('/kits/');
      const profileHref = (inKitsDir ? '../' : '') + 'profile.html';
      container.innerHTML = `
        <div class="auth-user">
          <a href="${profileHref}" class="auth-profile-link" title="Můj profil">
            <img src="https://mc-heads.net/avatar/${auth.nick}/24" alt="" class="auth-avatar">
            <span class="auth-nick">${auth.nick}</span>
          </a>
          <button class="auth-logout-btn" title="Odhlásit se">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      `;
      container.querySelector('.auth-logout-btn').addEventListener('click', logout);
    } else {
      const inKitsDir = location.pathname.includes('/kits/');
      const prefix = inKitsDir ? '../' : '';
      container.innerHTML = `
        <a href="${prefix}login.html" class="auth-login-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>Přihlásit se</span>
        </a>
      `;
    }

    header.appendChild(container);
  }

  // Auto-inject on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { checkHashToken(); injectLoginButton(); });
  } else {
    checkHashToken();
    injectLoginButton();
  }

  // Export
  window.CZSKAuth = { register, login, logout, isLoggedIn, getCurrentUser, changePassword };
})();
