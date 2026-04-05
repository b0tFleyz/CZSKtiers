// Shared player count badge — works on overall + kit pages
// Call: updatePlayerCount(count) after data loads
(function () {
  // Create container in header if missing
  let container = document.getElementById('player-count-container');
  if (!container) {
    const header = document.querySelector('.main-header');
    if (!header) return;
    container = document.createElement('div');
    container.id = 'player-count-container';
    container.className = 'header-player-count';
    header.appendChild(container);
  }

  function animateCount(el, target) {
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.updatePlayerCount = function (total) {
    if (!container || total <= 0) return;
    let badge = container.querySelector('.player-count-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'player-count-badge';
      container.appendChild(badge);
    }
    badge.innerHTML =
      '<span class="player-count-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>' +
      '<span class="player-count-num" data-target="' + total + '">0</span> ' +
      '<span class="player-count-label">hráčů</span>';
    const numEl = badge.querySelector('.player-count-num');
    const observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        animateCount(numEl, total);
      }
    }, { threshold: 0.3 });
    observer.observe(badge);
  };
})();
