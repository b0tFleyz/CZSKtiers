// Dynamic navigation builder with guild toggle
(function () {
  // --- Check for incoming guild switch (show cover + reveal) ---
  const guildSwitchData = sessionStorage.getItem('guildSwitch');
  if (guildSwitchData) {
    sessionStorage.removeItem('guildSwitch');
    try {
      const gs = JSON.parse(guildSwitchData);
      const cover = document.createElement('div');
      cover.className = 'guild-overlay active';
      cover.style.setProperty('--ov-accent', gs.accent);
      cover.style.clipPath = 'circle(150% at 50% 0)';
      cover.innerHTML = `<span class="guild-overlay-text">${gs.name}</span><div class="guild-overlay-spinner"><div class="spinner"></div><p>Načítání...</p></div>`;
      document.body.appendChild(cover);
      // Force the overlay to paint before showing body content
      cover.offsetHeight; // force layout/paint
      document.body.style.visibility = '';
      // Reveal the page once content is ready (min 600ms)
      let revealed = false;
      const revealPage = () => {
        if (revealed) return;
        revealed = true;
        cover.style.transition = 'clip-path 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease 0.5s';
        cover.style.clipPath = 'circle(0% at 100% 100%)';
        setTimeout(() => cover.remove(), 900);
      };
      // Wait for tabulka to have content, or timeout after 5s
      const waitForContent = () => {
        const tabulka = document.getElementById('overall-tabulka') || document.querySelector('.tabulka.active');
        if (tabulka && tabulka.children.length > 0 && !tabulka.classList.contains('tabulka-loading')) {
          setTimeout(revealPage, 200);
        } else {
          setTimeout(waitForContent, 100);
        }
      };
      setTimeout(waitForContent, 600);
      // Fallback: reveal after 5s no matter what
      setTimeout(revealPage, 5000);
    } catch (e) {}
  }

  const guild = getActiveGuild();
  const conf = getGuildConf(guild);

  // Determine path prefix based on current page location
  const inKitsDir = location.pathname.includes('/kits/');
  const prefix = inKitsDir ? '../' : '';
  const kitsPrefix = inKitsDir ? '' : 'kits/';

  // Detect current page slug for active state
  const page = location.pathname.split('/').pop().replace('.html', '') || 'overall';

  // --- Sweep bar helper ---
  function createSweep() {
    const bar = document.createElement('div');
    bar.className = 'page-sweep';
    document.body.appendChild(bar);
    return bar;
  }

  function playSweep(callback) {
    const bar = createSweep();
    requestAnimationFrame(() => bar.classList.add('active'));
    setTimeout(() => {
      if (callback) callback();
    }, 450);
  }

  // --- Build guild toggle ---
  const toggle = document.createElement('div');
  toggle.className = 'guild-toggle';
  toggle.innerHTML = `
    <button class="guild-toggle-btn${guild === 'czsktiers' ? ' active' : ''}" data-guild="czsktiers">
      <span class="guild-toggle-label">CZSKTiers</span>
    </button>
    <button class="guild-toggle-btn${guild === 'subtiers' ? ' active' : ''}" data-guild="subtiers">
      <span class="guild-toggle-label">CZSKSubtiers</span>
    </button>
    <span class="guild-toggle-slider"></span>
  `;

  // Position the slider on load
  requestAnimationFrame(() => {
    const slider = toggle.querySelector('.guild-toggle-slider');
    const activeBtn = toggle.querySelector('.guild-toggle-btn.active');
    if (slider && activeBtn) {
      slider.style.width = activeBtn.offsetWidth + 'px';
      slider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
  });

  toggle.querySelectorAll('.guild-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newGuild = btn.dataset.guild;
      if (newGuild === guild) return;
      setActiveGuild(newGuild);

      // Animate slider to new position
      const slider = toggle.querySelector('.guild-toggle-slider');
      if (slider) {
        slider.style.width = btn.offsetWidth + 'px';
        slider.style.transform = `translateX(${btn.offsetLeft}px)`;
      }

      // Mark new button active
      toggle.querySelectorAll('.guild-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Full-screen guild overlay then navigate
      const newConf = getGuildConf(newGuild);
      document.documentElement.style.setProperty('--accent', newConf.accent);
      document.documentElement.style.setProperty('--accent-rgb', newConf.accentRGB);
      // Store switch info so the new page shows overlay + reveal
      sessionStorage.setItem('guildSwitch', JSON.stringify({ name: newConf.name, accent: newConf.accent }));
      showGuildOverlay(newConf.name, newConf.accent, () => {
        window.location.href = prefix + 'overall.html';
      });
    });
  });

  // --- Guild overlay ---
  function showGuildOverlay(guildName, accent, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'guild-overlay';
    overlay.style.setProperty('--ov-accent', accent);
    overlay.style.clipPath = 'circle(0% at 50% 0)';
    overlay.innerHTML = `<span class="guild-overlay-text">${guildName}</span><div class="guild-overlay-spinner"><div class="spinner"></div><p>Načítání...</p></div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.transition = 'clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      overlay.style.clipPath = 'circle(150% at 50% 0)';
      overlay.classList.add('active');
    });
    setTimeout(() => {
      if (callback) callback();
    }, 800);
  }

  // --- Build navigation ---
  const nav = document.querySelector('nav ul');
  if (nav) {
    nav.innerHTML = '';
    // Overall link
    const overallLi = document.createElement('li');
    overallLi.style.setProperty('--nav-i', '0');
    const isOverall = page === 'overall';
    overallLi.innerHTML = `<a href="${prefix}overall.html" class="nav-btn${isOverall ? ' active' : ''}">Overall<img class="kit-nav-icon" src="${prefix}kit_icons/trophy.png"></a>`;
    nav.appendChild(overallLi);

    // Kit links
    conf.kits.forEach((kit, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--nav-i', String(i + 1));
      const isActive = page === kit.slug;
      li.innerHTML = `<a href="${kitsPrefix}${kit.slug}.html" class="nav-btn${isActive ? ' active' : ''}">${kit.label}<img class="kit-nav-icon" src="${prefix}kit_icons/${kit.icon}"></a>`;
      nav.appendChild(li);
    });

    // Navigate directly on nav link clicks (no sweep transition)
    nav.querySelectorAll('a.nav-btn').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.classList.contains('active')) return; // already on this page
      });
    });
  }

  // Insert toggle into header
  const header = document.querySelector('.main-header');
  if (header) {
    header.insertBefore(toggle, header.firstChild);
  }

  // Apply guild accent as CSS custom property
  document.documentElement.style.setProperty('--accent', conf.accent);
  document.documentElement.style.setProperty('--accent-rgb', conf.accentRGB);

  // Update page title and header to match guild
  const titleEl = document.querySelector('.main-title');
  if (titleEl) titleEl.textContent = conf.name;
  document.title = document.title.replace(/CZSKTiers|CZSKSubtiers|SubTiers|CZSK Tierlist/, conf.name);

  // Update discord link to match guild
  const discordLink = document.querySelector('.discord-link');
  if (discordLink && conf.discord) {
    discordLink.href = conf.discord;
  }
})();
