(function () {
  const timeoutMs = Number(window.APP_ABANDON_TIMEOUT_MS || 180000);
  const hiddenKey = 'torneos:lastHiddenAt';
  const heartbeatMs = 60000;

  function isLoginLikePage() {
    return ['/login', '/registro', '/'].includes(window.location.pathname);
  }

  function heartbeat() {
    if (document.hidden || isLoginLikePage()) return;
    fetch('/session/heartbeat', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    }).catch(() => {});
  }

  function cerrarPorAbandono() {
    sessionStorage.removeItem(hiddenKey);
    window.location.replace('/logout?motivo=abandono');
  }

  function revisarAbandono() {
    const hiddenAt = Number(sessionStorage.getItem(hiddenKey) || 0);
    if (hiddenAt && Date.now() - hiddenAt >= timeoutMs) {
      cerrarPorAbandono();
      return;
    }
    sessionStorage.removeItem(hiddenKey);
    heartbeat();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sessionStorage.setItem(hiddenKey, String(Date.now()));
    } else {
      revisarAbandono();
    }
  });

  window.addEventListener('pagehide', () => {
    sessionStorage.setItem(hiddenKey, String(Date.now()));
  });

  window.addEventListener('pageshow', revisarAbandono);
  window.addEventListener('focus', revisarAbandono);
  setInterval(heartbeat, heartbeatMs);
  heartbeat();
})();
