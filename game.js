(() => {
  // ── 1. CONFIGURACIÓN Y ESTADO ─────────────────────────────────────────────
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  // Alias pequeño para mantener las consultas al DOM legibles.
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Tamaño del canvas y reloj general.
  let w = innerWidth;
  let h = innerHeight;
  let dpr = 1;
  let last = 0;
  let time = 0;
  let firing = false;

  // Progreso de la sesión y preferencias del menú.
  let state = 'menu';
  let score = 0;
  let wave = 0;
  let lives = 3;
  let spawnClock = 0;
  let toastClock = 0;
  let shake = 0;
  let hitStop = 0;
  let screenFlash = 0;
  let wavePulse = 0;
  let soundOn = true;
  let audio = null;
  let particlesOn = true;
  let shakeOn = true;
  let difficulty = 'NORMAL';
  let best = Number(localStorage.getItem('neonArenaBest') || 0);

  // Colecciones de objetos que se actualizan y dibujan en cada fotograma.
  const keys = new Set();
  const bullets = [];
  const enemyShots = [];
  const enemies = [];
  const particles = [];
  const pickups = [];
  const mouse = { x: w / 2 + 100, y: h / 2 };
  const player = {
    x: w / 2,
    y: h / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    recoil: 0,
    trail: [],
    invulnerable: 0,
    shield: 0,
    triple: 0,
    speedBoost: 0
  };
  const colors = ['#ff3ca6', '#a855f7', '#ff6b4a', '#f6b73c'];

  // ── 2. CANVAS, ALMACENAMIENTO Y AUDIO ────────────────────────────────────
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.x = clamp(player.x, 20, w - 20);
    player.y = clamp(player.y, 20, h - 20);
  }
  addEventListener('resize', resize); resize();
  function updateBest() {
    best = Math.max(best, score);
    localStorage.setItem('neonArenaBest', best);
    $('best-score').textContent = String(best).padStart(6, '0');
  }
  $('best-score').textContent = String(best).padStart(6, '0');

  function tone(freq, duration = .09, type = 'sine', volume = .035, slide = 1) {
    if (!soundOn) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume();

      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (_) { /* Audio is optional; the game still runs if the browser blocks it. */ }
  }
  // Refuerza los golpes con pausa, destello y sacudida de cámara.
  function impact(power = 1) {
    hitStop = Math.max(hitStop, .055 * power);
    screenFlash = Math.max(screenFlash, .2 * power);
    shake = Math.min(shake + 2 * power, 12);
  }

  // ── 3. INTERFAZ, MENÚS Y HUD ─────────────────────────────────────────────
  function startGame() {
    score = 0;
    wave = 0;
    lives = 3;
    spawnClock = .7;
    shotClock = 0;
    hitStop = 0;

    // Vacía las entidades para que una nueva partida empiece limpia.
    bullets.length = 0;
    enemyShots.length = 0;
    enemies.length = 0;
    particles.length = 0;
    pickups.length = 0;

    player.x = w / 2;
    player.y = h / 2;
    player.vx = 0;
    player.vy = 0;
    player.trail.length = 0;
    player.invulnerable = 1.5;
    player.shield = 0;
    player.triple = 0;
    player.speedBoost = 0;

    updateHud();
    updateBoostHud();
    showToast('PREPÁRATE');
    state = 'playing';
    $('menu').classList.add('hidden');
    $('game-hud').classList.remove('hidden');
    firing = false;
    tone(440, .2, 'triangle', .05, 1.8);
  }
  function updateHud() {
    $('score').textContent = String(score).padStart(6, '0');
    $('wave').textContent = String(wave).padStart(2, '0');
    $('lives').textContent = Array.from({ length: 3 }, (_, i) => i < lives ? '◆' : '◇').join(' ');
  }

  function updateBoostHud() {
    const activeBoosts = [];
    if (player.shield > 0) activeBoosts.push(`ESCUDO ${Math.ceil(player.shield)}s`);
    if (player.triple > 0) activeBoosts.push(`TRIPLE ${Math.ceil(player.triple)}s`);
    if (player.speedBoost > 0) activeBoosts.push(`IMPULSO ${Math.ceil(player.speedBoost)}s`);
    $('boost-status').textContent = activeBoosts.join(' · ');
  }

  function showToast(text) {
    $('toast').textContent = text;
    $('toast').classList.remove('hidden');
    toastClock = 1.7;
  }
  function showMenu(panel = '') {
    state = 'menu';
    firing = false;
    $('game-hud').classList.add('hidden');
    $('menu').classList.remove('hidden', 'modal-state');

    const subpanel = $('subpanel');
    subpanel.classList.toggle('hidden', !panel);

    if (panel === 'options') {
      subpanel.innerHTML = `
        <h2>OPCIONES</h2>
        <label>Partículas <input id="particle-setting" type="checkbox" ${particlesOn ? 'checked' : ''}></label>
        <label>Sacudida de cámara <input id="shake-setting" type="checkbox" ${shakeOn ? 'checked' : ''}></label>
        <label>Sonido <input id="sound-setting" type="checkbox" ${soundOn ? 'checked' : ''}></label>
        <label>Dificultad
          <select id="difficulty-setting">
            <option ${difficulty === 'NORMAL' ? 'selected' : ''}>NORMAL</option>
            <option ${difficulty === 'FÁCIL' ? 'selected' : ''}>FÁCIL</option>
            <option ${difficulty === 'DIFÍCIL' ? 'selected' : ''}>DIFÍCIL</option>
          </select>
        </label>
        <button class="menu-button" data-action="back">← VOLVER</button>`;
    } else if (panel === 'credits') {
      subpanel.innerHTML = `
        <h2>CRÉDITOS</h2>
        <p>NEON//ARENA<br>Un pequeño arcade de supervivencia.<br><br>
          <span style="color:#7683a1;font-size:10px;letter-spacing:.18em">CATEGORÍA</span><br>
          <strong style="color:#00eaff">Maximiliano Madrid Benavides</strong>
        </p>
        <button class="menu-button" data-action="back">← VOLVER</button>`;
    } else {
      subpanel.innerHTML = '';
    }

    $('best-score').textContent = String(best).padStart(6, '0');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      firing = false;
      $('menu').classList.remove('hidden');
      $('menu').classList.add('modal-state');
      $('subpanel').classList.remove('hidden');
      $('subpanel').innerHTML = `
        <h2>PAUSA</h2>
        <p>La arena puede esperar. Tú decides cuándo volver.</p>
        <button class="menu-button primary" data-action="resume">▶ CONTINUAR</button>
        <button class="menu-button" data-action="restart">↻ REINICIAR</button>
        <button class="menu-button" data-action="menu">⌂ MENÚ PRINCIPAL</button>`;
    } else if (state === 'paused') {
      state = 'playing';
      $('menu').classList.add('hidden');
      $('menu').classList.remove('modal-state');
      firing = false;
    }
  }

  $('main-menu').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'play') startGame();
    if (action === 'options' || action === 'credits') showMenu(action);
  });

  $('subpanel').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') showMenu();
    if (action === 'resume') togglePause();
    if (action === 'restart') startGame();
    if (action === 'menu') showMenu();
  });

  $('subpanel').addEventListener('change', event => {
    const control = event.target;
    if (control.id === 'particle-setting') particlesOn = control.checked;
    if (control.id === 'shake-setting') shakeOn = control.checked;
    if (control.id === 'sound-setting') soundOn = control.checked;
    if (control.id === 'difficulty-setting') difficulty = control.value;
  });
  $('pause-button').addEventListener('click', togglePause);

  // ── 4. CONTROLES ─────────────────────────────────────────────────────────
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === ' ') firing = true;

    if (k === 'escape' || k === 'p') {
      if (state === 'playing' || state === 'paused') togglePause();
      else if (state === 'gameover') showMenu();
    }
    if (state === 'menu' && (k === 'enter' || k === ' ')) startGame();
  });

  addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
    if (e.key === ' ') firing = false;
  });
  addEventListener('blur', () => {
    keys.clear();
    firing = false;
  });

  canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 0 && state === 'playing') firing = true;
  });
  addEventListener('pointerup', e => {
    if (e.button === 0) firing = false;
  });

  // ── 5. EFECTOS Y CREACIÓN DE ENTIDADES ───────────────────────────────────
  function burst(x, y, color, count = 18, force = 170) {
    if (!particlesOn) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = force * (.25 + Math.random() * .8);
      const life = .3 + Math.random() * .55;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        max: life,
        size: 1 + Math.random() * 3,
        color
      });
    }
  }
  let shotClock = 0;

  function shoot() {
    const c = Math.cos(player.angle);
    const s = Math.sin(player.angle);
    const spread = player.triple > 0 ? [-.16, 0, .16] : [0];
    for (const offset of spread) {
      const angle = player.angle + offset;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      bullets.push({
        x: player.x + directionX * 25,
        y: player.y + directionY * 25,
        vx: directionX * 850 + player.vx * .2,
        vy: directionY * 850 + player.vy * .2,
        life: .8
      });
    }

    player.recoil = 1;
    shake = Math.min(shake + 1.05, 5);
    burst(player.x + c * 26, player.y + s * 26, '#bfffff', 3, 60);
    tone(player.triple > 0 ? 560 : 480, .055, 'square', .018, .65);
  }

  // Crea enemigos en un borde aleatorio y elige su especie según la oleada.
  function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    const padding = 28;
    const x = side === 0 ? -padding : side === 1 ? w + padding : Math.random() * w;
    const y = side === 2 ? -padding : side === 3 ? h + padding : Math.random() * h;
    const roll = Math.random();
    const type = chooseEnemyType(roll);
    const stats = getEnemyStats(type);
    const difficultyScale = difficulty === 'FÁCIL' ? .78 : difficulty === 'DIFÍCIL' ? 1.28 : 1;

    enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      ...stats,
      speed: stats.speed * difficultyScale * (1 + wave * .035),
      type,
      wobble: Math.random() * TAU,
      spin: Math.random() * TAU,
      fireClock: 1 + Math.random() * .8
    });
  }

  function chooseEnemyType(roll) {
    if (wave >= 4 && roll < .14) return 'guardian';
    if (wave >= 3 && roll < .32) return 'shooter';
    if (wave >= 4 && roll < .48) return 'brute';
    if (wave >= 2 && roll < .68) return 'runner';
    return 'hunter';
  }

  function getEnemyStats(type) {
    const stats = {
      brute: { r: 23, hp: 3, speed: 45, color: '#ff4b55' },
      runner: { r: 13, hp: 1, speed: 142, color: '#ffc247' },
      shooter: { r: 18, hp: 2, speed: 58, color: '#ff4bd8' },
      guardian: { r: 21, hp: 3, speed: 48, color: '#7f7bff' },
      hunter: {
        r: 17,
        hp: 1 + (wave > 5 && Math.random() < .25 ? 1 : 0),
        speed: 72,
        color: colors[Math.floor(Math.random() * 3)]
      }
    };
    return stats[type];
  }
  function spawnPickup(x, y) {
    const types = ['shield', 'triple', 'speed'];
    const type = types[Math.floor(Math.random() * types.length)];
    const colorsByType = { shield: '#50eeff', triple: '#ff55d4', speed: '#ffe35a' };
    pickups.push({ x, y, type, color: colorsByType[type], life: 11, spin: Math.random() * TAU });
    tone(720, .12, 'sine', .035, 1.5);
  }

  function collectPickup(type) {
    const effects = {
      shield: { duration: 10, message: 'ESCUDO · 10 S', color: '#50eeff', frequency: 440, noteLength: .3, wave: 'sine', volume: .06 },
      triple: { duration: 9, message: 'DISPARO TRIPLE · 9 S', color: '#ff55d4', frequency: 520, noteLength: .3, wave: 'square', volume: .04 },
      speed: { duration: 8, message: 'IMPULSO · 8 S', color: '#ffe35a', frequency: 620, noteLength: .28, wave: 'sawtooth', volume: .035 }
    };
    const effect = effects[type];
    if (!effect) return;

    if (type === 'shield') player.shield = effect.duration;
    if (type === 'triple') player.triple = effect.duration;
    if (type === 'speed') player.speedBoost = effect.duration;
    showToast(effect.message);
    tone(effect.frequency, effect.noteLength, effect.wave, effect.volume, 2);
    burst(player.x, player.y, effect.color, 24, 200);
  }

  function damagePlayer() {
    if (player.shield > 0) {
      player.shield = 0;
      player.invulnerable = .9;
      showToast('ESCUDO ROTO');
      burst(player.x, player.y, '#50eeff', 30, 260);
      tone(190, .22, 'sawtooth', .055, .45);
      impact(1.5);
      return;
    }

    lives--;
    player.invulnerable = 1.4;
    impact(2.3);
    burst(player.x, player.y, '#00eaff', 28, 250);
    tone(120, .32, 'sawtooth', .075, .35);
    updateHud();
    if (lives <= 0) endGame();
  }

  // ── 6. ACTUALIZACIÓN DE LA PARTIDA ───────────────────────────────────────
  function update(dt) {
    time += dt;
    updateTransientEffects(dt);
    if (state !== 'playing') return;

    updatePlayer(dt);
    updateWave(dt);
    updatePlayerBullets(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updatePickups(dt);
    updateParticles(dt);
  }

  // Estos efectos siguen avanzando también en el menú y durante la pausa.
  function updateTransientEffects(dt) {
    if (toastClock > 0) {
      toastClock -= dt;
      if (toastClock <= 0) $('toast').classList.add('hidden');
    }
    wavePulse = Math.max(0, wavePulse - dt * .65);
    screenFlash = Math.max(0, screenFlash - dt * 2.2);
    shake *= Math.exp(-14 * dt);
  }

  function updatePlayer(dt) {
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.shield = Math.max(0, player.shield - dt);
    player.triple = Math.max(0, player.triple - dt);
    player.speedBoost = Math.max(0, player.speedBoost - dt);
    updateBoostHud();

    // Normaliza el vector para que moverse en diagonal no sea más rápido.
    let moveX = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let moveY = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    const inputLength = Math.hypot(moveX, moveY) || 1;
    moveX /= inputLength;
    moveY /= inputLength;

    const boosted = player.speedBoost > 0;
    const drag = Math.exp(-7.5 * dt);
    const maxSpeed = boosted ? 520 : 390;
    const acceleration = boosted ? 2900 : 2300;
    player.vx = (player.vx + moveX * acceleration * dt) * drag;
    player.vy = (player.vy + moveY * acceleration * dt) * drag;

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx *= maxSpeed / speed;
      player.vy *= maxSpeed / speed;
    }

    player.x = clamp(player.x + player.vx * dt, 20, w - 20);
    player.y = clamp(player.y + player.vy * dt, 20, h - 20);
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    player.recoil *= Math.exp(-13 * dt);

    player.trail.push({ x: player.x, y: player.y, a: .2 + Math.min(speed / maxSpeed, 1) * .5 });
    if (player.trail.length > 13) player.trail.shift();

    shotClock -= dt;
    if (firing && shotClock <= 0) {
      shoot();
      shotClock = .115;
    }
  }

  function updateWave(dt) {
    spawnClock -= dt;
    if (spawnClock > 0) return;

    if (enemies.length === 0) {
      wave++;
      updateHud();
      showToast(`OLEADA ${String(wave).padStart(2, '0')}`);
      wavePulse = 1;
      tone(220 + Math.min(wave, 12) * 18, .35, 'sawtooth', .045, 1.8);
    }

    const enemiesToSpawn = Math.min(1 + Math.floor(wave * .42), 5);
    for (let i = 0; i < enemiesToSpawn; i++) spawnEnemy();
    spawnClock = Math.max(.42, 1.5 - wave * .055);
  }

  function updatePlayerBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -50 || bullet.x > w + 50 || bullet.y < -50 || bullet.y > h + 50) {
        bullets.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;

      moveEnemy(enemy, dx, dy, distance, dt);
      hitEnemyWithPlayerBullet(enemy, i);

      if (enemies[i] && distance < enemy.r + 17 && player.invulnerable <= 0) {
        enemies.splice(i, 1);
        damagePlayer();
      }
    }
  }

  function moveEnemy(enemy, dx, dy, distance, dt) {
    const speedFactor = enemy.type === 'runner' ? 9 : enemy.type === 'brute' ? 2 : 4;
    enemy.wobble += dt * speedFactor;
    enemy.spin += dt * (enemy.type === 'brute' ? -.8 : 1.4);

    let direction = 1;
    if (enemy.type === 'shooter') {
      // El tirador busca una distancia cómoda y avisa cargando su núcleo.
      if (distance < 175) direction = -1;
      else if (distance < 250) direction = 0;
      enemy.fireClock -= dt;

      if (enemy.fireClock <= 0 && distance < 560) {
        const angle = Math.atan2(dy, dx);
        enemyShots.push({
          x: enemy.x + Math.cos(angle) * 18,
          y: enemy.y + Math.sin(angle) * 18,
          vx: Math.cos(angle) * 280,
          vy: Math.sin(angle) * 280,
          life: 3
        });
        enemy.fireClock = Math.max(.9, 1.8 - wave * .035);
        tone(180, .1, 'triangle', .02, .5);
      }
    }

    enemy.vx = dx / distance * enemy.speed * direction;
    enemy.vy = dy / distance * enemy.speed * direction;
    enemy.x += (enemy.vx + Math.cos(enemy.wobble) * 12) * dt;
    enemy.y += (enemy.vy + Math.sin(enemy.wobble) * 12) * dt;
  }

  function hitEnemyWithPlayerBullet(enemy, enemyIndex) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) >= enemy.r + 5) continue;

      const protectedByGuardian = enemy.type !== 'guardian' && isProtectedByGuardian(enemy);
      bullets.splice(i, 1);

      if (protectedByGuardian) {
        burst(bullet.x, bullet.y, '#9a91ff', 5, 75);
        tone(260, .08, 'sine', .025, 1.7);
        return;
      }

      enemy.hp--;
      burst(bullet.x, bullet.y, enemy.color, 7, 115);
      tone(260, .06, 'triangle', .025, 1.6);

      if (enemy.hp <= 0) defeatEnemy(enemy, enemyIndex);
      else impact(.35);
      return;
    }
  }

  function defeatEnemy(enemy, enemyIndex) {
    const heavyEnemy = enemy.type === 'brute' || enemy.type === 'guardian';
    burst(enemy.x, enemy.y, enemy.color, heavyEnemy ? 34 : 24, 230);
    impact(1.2);
    enemies.splice(enemyIndex, 1);
    score += enemy.type === 'brute' || enemy.type === 'guardian' ? 300
      : enemy.type === 'runner' ? 150
      : enemy.type === 'shooter' ? 200
      : 100;
    updateHud();
    updateBest();
    tone(660, .16, 'triangle', .06, 2.1);
    if (Math.random() < .18) spawnPickup(enemy.x, enemy.y);
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const bullet = enemyShots[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;

      const outsideArena = bullet.x < -20 || bullet.x > w + 20 || bullet.y < -20 || bullet.y > h + 20;
      if (bullet.life <= 0 || outsideArena) {
        enemyShots.splice(i, 1);
        continue;
      }

      if (player.invulnerable <= 0 && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 20) {
        enemyShots.splice(i, 1);
        damagePlayer();
      }
    }
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      pickup.life -= dt;
      pickup.spin += dt * 2;
      if (pickup.life <= 0) {
        pickups.splice(i, 1);
      } else if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 29) {
        pickups.splice(i, 1);
        collectPickup(pickup.type);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-2.4 * dt);
      particle.vy *= Math.exp(-2.4 * dt);
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }
  function endGame() {
    state = 'gameover';
    firing = false;
    updateBest();
    $('menu').classList.remove('hidden');
    $('subpanel').classList.remove('hidden');
    $('menu').classList.add('modal-state');
    $('subpanel').innerHTML = `
      <div class="eyebrow">FIN DE LA PARTIDA</div>
      <h2>SE ACABÓ.</h2>
      <p>Puntuación: <strong style="color:#00eaff">${String(score).padStart(6, '0')}</strong><br>
        Oleada alcanzada: <strong style="color:#ff4ab9">${String(wave).padStart(2, '0')}</strong><br>
        Récord: <strong style="color:#ff4ab9">${String(best).padStart(6, '0')}</strong>
      </p>
      <button class="menu-button primary" data-action="restart">↻ VOLVER A JUGAR</button>
      <button class="menu-button" data-action="menu">⌂ MENÚ PRINCIPAL</button>`;
  }

  // ── 7. DIBUJO: FONDO, JUGADOR, OBJETOS Y ENEMIGOS ────────────────────────
  function drawBackground() {
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, w, h);

    // La luz ambiente late suavemente; cada nueva oleada amplifica el pulso.
    const beat = .5 + .5 * Math.sin(time * 3.2);
    const pulse = wavePulse * .7 + beat * .08;
    const glow = ctx.createRadialGradient(w * .5, h * .52, 0, w * .5, h * .52, Math.max(w, h) * .72);
    glow.addColorStop(0, `rgb(${Math.round(17 + pulse * 32)} ${Math.round(19 + pulse * 5)} ${Math.round(42 + pulse * 22)})`);
    glow.addColorStop(.52, '#090b18');
    glow.addColorStop(1, '#05060d');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const spacing = 48;
    const offsetX = (time * 5) % spacing;
    const offsetY = (time * 5) % spacing;
    ctx.fillStyle = '#8ca3ff19';
    for (let x = offsetX; x < w; x += spacing) {
      for (let y = offsetY; y < h; y += spacing) {
        ctx.globalAlpha = .45 + beat * .45;
        ctx.beginPath();
        ctx.arc(x, y, 1 + beat * .45, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (wavePulse > 0) {
      ctx.save();
      ctx.globalAlpha = wavePulse * .48;
      ctx.strokeStyle = '#00eaff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00eaff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (1 - wavePulse) * Math.max(w, h) * .68, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = '#5d6cff18';
    ctx.strokeRect(14, 14, w - 28, h - 28);
  }
  function drawPlayer() {
    // Estela de movimiento con transparencia gradual.
    for (let i = 0; i < player.trail.length; i++) {
      const point = player.trail[i];
      const fade = (i + 1) / player.trail.length;
      ctx.globalAlpha = point.a * fade * .45;
      ctx.fillStyle = '#00efff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00eaff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3 + fade * 4, 0, TAU);
      ctx.fill();
    }

    // El parpadeo muestra el breve periodo de invulnerabilidad tras un golpe.
    ctx.globalAlpha = player.invulnerable > 0 && Math.floor(time * 14) % 2 ? .25 : 1;
    if (player.shield > 0) drawPlayerShield();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00eaff';
    ctx.strokeStyle = '#00efff';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';

    // Nave triangular; el retroceso desplaza el casco hacia atrás al disparar.
    ctx.beginPath();
    ctx.moveTo(-16 - player.recoil * 6, -12);
    ctx.lineTo(13, 0);
    ctx.lineTo(-16 - player.recoil * 6, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#00eaff1e';
    ctx.fill();

    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#e4ffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(6, 0);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.stroke();

    // La longitud del escape cambia con la animación y el retroceso.
    const flameLength = 9 + Math.sin(time * 45) * 3 + player.recoil * 8;
    ctx.globalAlpha = .85;
    ctx.shadowColor = '#ff3ca6';
    ctx.shadowBlur = 19;
    ctx.strokeStyle = '#ff4ca8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(-13 - flameLength - player.recoil * 6, 0);
    ctx.lineTo(-13, 4);
    ctx.stroke();
    ctx.restore();

    // La retícula acompaña el cursor para reforzar la dirección de apuntado.
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(time * .5);
    ctx.strokeStyle = '#ff54bfaa';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff34b7';
    ctx.beginPath();
    ctx.arc(0, 0, 10, .25, 1.15);
    ctx.arc(0, 0, 10, Math.PI + .25, Math.PI + 1.15);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawPlayerShield() {
    ctx.save();
    ctx.strokeStyle = '#50eeff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = .7 + Math.sin(time * 10) * .2;
    ctx.shadowColor = '#50eeff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 27 + Math.sin(time * 7) * 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  function drawWorld() {
    ctx.save();
    if (shakeOn && shake > .05) {
      ctx.translate((Math.random() - .5) * shake * 2, (Math.random() - .5) * shake * 2);
    }

    // Orden de capas: partículas, mejoras, disparos, enemigos y jugador.
    drawParticles();
    drawPickups();
    drawProjectiles();
    drawEnemies();
    if (state === 'playing' || state === 'paused' || state === 'gameover') drawPlayer();

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups() {
    for (const pickup of pickups) {
      const bob = Math.sin(time * 5 + pickup.spin) * 4;
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.rotate(pickup.spin);
      ctx.shadowColor = pickup.color;
      ctx.shadowBlur = 24;
      ctx.fillStyle = pickup.color + '36';
      ctx.strokeStyle = pickup.color;
      ctx.lineWidth = 2;

      // El rombo exterior comparte forma; el símbolo interior identifica la mejora.
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.rotate(-pickup.spin);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      if (pickup.type === 'shield') {
        ctx.arc(0, 0, 5, Math.PI, 0);
        ctx.lineTo(5, 4);
        ctx.lineTo(0, 7);
        ctx.lineTo(-5, 4);
        ctx.closePath();
      } else if (pickup.type === 'triple') {
        ctx.moveTo(-5, -5);
        ctx.lineTo(0, 0);
        ctx.lineTo(-5, 5);
        ctx.moveTo(0, -5);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 5);
      } else {
        ctx.moveTo(1, -7);
        ctx.lineTo(-4, 1);
        ctx.lineTo(0, 1);
        ctx.lineTo(-2, 7);
        ctx.lineTo(5, -2);
        ctx.lineTo(1, -2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectiles() {
    ctx.lineCap = 'round';
    for (const bullet of bullets) {
      ctx.globalAlpha = Math.min(1, bullet.life / .12);
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#00efff';
      ctx.strokeStyle = '#00eaff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * .027, bullet.y - bullet.vy * .027);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * .009, bullet.y - bullet.vy * .009);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    for (const bullet of enemyShots) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ff4bd8';
      ctx.fillStyle = '#ff9bec';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff4bd8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * .035, bullet.y - bullet.vy * .035);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      drawEnemy(enemy);
      if (enemy.type !== 'guardian' && isProtectedByGuardian(enemy)) {
        drawGuardianAura(enemy);
      }
    }
  }

  function isProtectedByGuardian(enemy) {
    return enemies.some(guardian =>
      guardian.type === 'guardian' && Math.hypot(guardian.x - enemy.x, guardian.y - enemy.y) < 86
    );
  }

  function drawGuardianAura(enemy) {
    ctx.save();
    ctx.globalAlpha = .24 + Math.sin(time * 8) * .08;
    ctx.strokeStyle = '#a7a4ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#a7a4ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r * 1.9, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // Dibuja el enemigo según su tipo y conserva el núcleo compartido.
  function drawEnemy(e) {
    const pulse = 1 + Math.sin(time * 8 + e.wobble) * .08;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.spin);
    ctx.scale(pulse, pulse);
    // El halo y la órbita giratoria separan la silueta del fondo oscuro.
    const aura = ctx.createRadialGradient(0, 0, e.r * .2, 0, 0, e.r * 1.8);
    aura.addColorStop(0, e.color + '55');
    aura.addColorStop(1, e.color + '00');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.8, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = e.color + 'aa';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 24;
    ctx.setLineDash([e.type === 'brute' ? 5 : 3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.42, time * 1.4, time * 1.4 + TAU * .78);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowBlur = 30;
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = e.color;
    ctx.fillStyle = e.color + '42';
    ctx.beginPath();
    if (e.type === 'runner') {
      // Corredor: dardo triangular con aletas para comunicar velocidad.
      ctx.moveTo(0, -e.r * 1.45);
      ctx.lineTo(e.r * .8, e.r * .8);
      ctx.lineTo(0, e.r * .35);
      ctx.lineTo(-e.r * .8, e.r * .8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-e.r * .65, e.r * .35);
      ctx.lineTo(-e.r * 1.45, e.r * .95);
      ctx.lineTo(-e.r * .25, e.r * .75);
      ctx.moveTo(e.r * .65, e.r * .35);
      ctx.lineTo(e.r * 1.45, e.r * .95);
      ctx.lineTo(e.r * .25, e.r * .75);
      ctx.stroke();
    } else if (e.type === 'shooter') {
      // Tirador: núcleo magenta que se ilumina antes de lanzar un proyectil.
      ctx.moveTo(0, -e.r * 1.15);
      ctx.lineTo(e.r * .9, 0);
      ctx.lineTo(0, e.r * 1.15);
      ctx.lineTo(-e.r * .9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#ffe6fb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * .62, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = e.fireClock < .35 ? '#fff' : '#ff9bec';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, e.fireClock < .35 ? 6 : 4, 0, TAU);
      ctx.fill();
    } else if (e.type === 'guardian') {
      // Guardián: dos capas hexagonales forman su blindaje.
      for (let layer = 0; layer < 2; layer++) {
        ctx.save();
        ctx.rotate(layer * Math.PI / 6);
        ctx.beginPath();
        for (let n = 0; n < 6; n++) {
          const angle = -Math.PI / 2 + n * TAU / 6;
          const radius = e.r * (layer ? .68 : 1.18);
          if (n === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath();
        ctx.globalAlpha = layer ? .55 : 1;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#e6e4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * .48, 0, TAU);
      ctx.stroke();
    } else if (e.type === 'brute') {
      // Blindado: rombo robusto y cuatro cuchillas en las esquinas.
      ctx.moveTo(0, -e.r * 1.25);
      ctx.lineTo(e.r * 1.05, -e.r * .38);
      ctx.lineTo(e.r * .85, e.r * .72);
      ctx.lineTo(0, e.r * 1.18);
      ctx.lineTo(-e.r * .85, e.r * .72);
      ctx.lineTo(-e.r * 1.05, -e.r * .38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (let n = 0; n < 4; n++) {
        ctx.save();
        ctx.rotate(n * Math.PI / 2 + .35);
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 1.05);
        ctx.lineTo(-4, -e.r * 1.55);
        ctx.lineTo(4, -e.r * 1.55);
        ctx.closePath();
        ctx.fillStyle = '#ffe8e8';
        ctx.fill();
        ctx.restore();
      }
    } else {
      // Cazador: carcasa hexagonal y anillo interno giratorio.
      for (let n = 0; n < 6; n++) {
        const angle = -Math.PI / 2 + n * TAU / 6;
        const x = Math.cos(angle) * e.r;
        const y = Math.sin(angle) * e.r;
        if (n === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.rotate(-e.spin * 1.8);
      ctx.strokeStyle = '#ffe4ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * .73, .3, Math.PI * 1.65);
      ctx.stroke();
    }
    // Núcleo luminoso; el arco exterior indica que todavía tiene vida.
    const core = e.type === 'brute' ? 7 : 5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff5fa';
    ctx.beginPath();
    ctx.arc(0, -1, core, 0, TAU);
    ctx.fill();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, -1, core * .52, 0, TAU);
    ctx.fill();

    if (e.hp > 1) {
      ctx.strokeStyle = '#fff4f4';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.13, -.8, Math.PI * 1.65);
      ctx.stroke();
    }
    if (e.type === 'guardian') {
      ctx.strokeStyle = '#a7a4ff';
      ctx.globalAlpha = .22;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 86, time * .5, time * .5 + TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }
  // ── 8. BUCLE PRINCIPAL ────────────────────────────────────────────────────
  function frame(now) {
    const elapsed = Math.min((now - last) / 1000 || 0, .033);
    last = now;

    // Reduce el tiempo de simulación brevemente al impactar para dar sensación de peso.
    if (hitStop > 0) hitStop = Math.max(0, hitStop - elapsed);
    update(elapsed * (hitStop > 0 ? .22 : 1));
    drawBackground();
    drawWorld();

    if (screenFlash > 0) {
      ctx.fillStyle = `rgba(150,245,255,${screenFlash * .18})`;
      ctx.fillRect(0, 0, w, h);
    }
    requestAnimationFrame(frame);
  }
  showMenu(); requestAnimationFrame(frame);
})();
