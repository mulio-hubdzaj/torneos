(function () {
  const timeoutMs = Number(window.APP_ABANDON_TIMEOUT_MS || 300000);
  const hiddenKey = 'torneos:lastHiddenAt';
  const heartbeatMs = 60000;
  const usagePingMs = 10 * 60 * 1000;
  let lastUsagePingAt = 0;

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
    registrarUso();
  }

  function detectarOrigen() {
    const userAgent = navigator.userAgent || '';
    return Boolean(window.Capacitor) || Boolean(window.AndroidDownloader) || /; wv\)/i.test(userAgent) ? 'apk' : 'web';
  }

  function registrarUso(forzar = false) {
    if (document.hidden || isLoginLikePage()) return;
    const ahora = Date.now();
    if (!forzar && ahora - lastUsagePingAt < usagePingMs) return;
    lastUsagePingAt = ahora;

    fetch('/uso/ping', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Torneos-Client': detectarOrigen()
      },
      body: JSON.stringify({ origen: detectarOrigen() })
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
  setInterval(registrarUso, usagePingMs);
  heartbeat();
  registrarUso(true);
})();
