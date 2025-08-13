// SwipeLite — no-backend demo dating app
// Data model is local to device via localStorage.
// Works on iPad Safari + GitHub Pages.

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEYS = {
  ME: 'swipelite.me',
  LIKES: 'swipelite.likes',
  PASSES: 'swipelite.passes',
  MATCHES: 'swipelite.matches'
};

const state = {
  profiles: [],
  index: 0, // pointer in profiles array
};

async function loadProfiles() {
  try {
    const res = await fetch('data/profiles.json', {cache: 'no-store'});
    state.profiles = await res.json();
  } catch (e) {
    console.error('Failed to load profiles:', e);
    state.profiles = [];
  }
}

function getMe() {
  const raw = localStorage.getItem(STORAGE_KEYS.ME);
  return raw ? JSON.parse(raw) : null;
}

function saveMe(data) {
  localStorage.setItem(STORAGE_KEYS.ME, JSON.stringify(data));
}

function pushLocal(key, value) {
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  if (!arr.includes(value)) arr.push(value);
  localStorage.setItem(key, JSON.stringify(arr));
  return arr;
}

function getLocal(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function clearAll() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}

// ----- UI -----
function setActiveView(name) {
  $$('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
    b.setAttribute('aria-selected', String(b.dataset.view === name));
  });
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
}

function renderCard(profile) {
  const el = document.createElement('div');
  el.className = 'card';
  el.setAttribute('data-id', profile.id);
  el.innerHTML = `
    <img alt="${profile.name}" src="${profile.photo}" onerror="this.src='assets/placeholder.jpg'">
    <div class="meta">
      <div>
        <div class="name">${profile.name}, ${profile.age}</div>
        <div class="bio">${profile.bio || ''}</div>
      </div>
      <span class="badge">${profile.city || ''}</span>
    </div>
  `;
  addSwipeHandlers(el);
  return el;
}

function addSwipeHandlers(card) {
  let startX = 0, startY = 0, currentX = 0, dragging = false;

  const onStart = (x,y) => {
    dragging = true;
    startX = x; startY = y; currentX = x;
    card.style.transition = 'none';
  };
  const onMove = (x,y) => {
    if (!dragging) return;
    currentX = x;
    const dx = x - startX;
    const rotate = dx / 20;
    card.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
    card.style.opacity = String(1 - Math.min(Math.abs(dx)/280, 0.5));
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    const dx = currentX - startX;
    const threshold = 100;
    if (dx > threshold) {
      like(card);
    } else if (dx < -threshold) {
      pass(card);
    } else {
      card.style.transition = 'transform 180ms ease, opacity 180ms ease';
      card.style.transform = '';
      card.style.opacity = '1';
    }
  };

  card.addEventListener('touchstart', (e)=> onStart(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
  card.addEventListener('touchmove', (e)=> onMove(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
  card.addEventListener('touchend', onEnd);

  card.addEventListener('mousedown', (e)=> onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e)=> onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onEnd);
}

function like(card) {
  const id = card.dataset.id;
  pushLocal(STORAGE_KEYS.LIKES, id);
  maybeMatch(id);
  dismissCard(card);
}

function pass(card) {
  const id = card.dataset.id;
  pushLocal(STORAGE_KEYS.PASSES, id);
  dismissCard(card);
}

function dismissCard(card) {
  card.style.transition = 'transform 250ms ease, opacity 250ms ease';
  const off = Math.random() > 0.5 ? 1 : -1;
  card.style.transform = `translate(${off*window.innerWidth}px, -40px) rotate(${off*20}deg)`;
  card.style.opacity = '0';
  setTimeout(()=> {
    card.remove();
    nextCard();
  }, 220);
}

function nextCard() {
  const stack = $('#card-stack');
  const shown = stack.children.length;
  // keep 3 cards in DOM
  while (stack.children.length < 3 && state.index < state.profiles.length) {
    const p = state.profiles[state.index++];
    const card = renderCard(p);
    stack.prepend(card); // newest on top
  }
  if (state.index >= state.profiles.length && stack.children.length === 0) {
    stack.innerHTML = '<p class="muted" style="text-align:center;margin-top:24px;">No more profiles. Reset demo data or come back later.</p>';
  }
}

function renderMatches() {
  const likes = new Set(getLocal(STORAGE_KEYS.LIKES));
  const matches = getLocal(STORAGE_KEYS.MATCHES);
  const ul = $('#matches-list');
  ul.innerHTML = '';

  const matchedProfiles = state.profiles.filter(p => matches.includes(String(p.id)) || (likes.has(String(p.id)) && p.likesYou));
  matchedProfiles.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = \`
      <img alt="\${p.name}" src="\${p.photo}" onerror="this.src='assets/placeholder.jpg'">
      <div>
        <div><strong>\${p.name}</strong> • \${p.city}</div>
        <div class="muted">It's a match! 🎉</div>
      </div>
      <a class="btn" style="margin-left:auto" href="mailto:demo@example.com?subject=Hi \${p.name}">Say hi</a>
    \`;
    ul.appendChild(li);
  });

  if (ul.children.length === 0) {
    ul.innerHTML = '<li class="muted">No matches yet — keep swiping!</li>';
  }
}

function maybeMatch(id) {
  // In this demo, some profiles have likesYou=true. If you like them too, it's a match.
  const p = state.profiles.find(p => String(p.id) === String(id));
  if (p && p.likesYou) {
    const arr = pushLocal(STORAGE_KEYS.MATCHES, String(p.id));
    renderMatches();
    alert("It's a match with " + p.name + " 🎉");
  }
}

function bindNav() {
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    setActiveView(b.dataset.view);
    if (b.dataset.view === 'matches') renderMatches();
  }));
}

function bindActions() {
  $('#btn-like').addEventListener('click', () => {
    const top = $('#card-stack .card');
    if (top) like(top);
  });
  $('#btn-dislike').addEventListener('click', () => {
    const top = $('#card-stack .card');
    if (top) pass(top);
  });
  $('#reset-data').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Reset demo data on this device?')) {
      clearAll();
      location.reload();
    }
  });
}

function bindProfileForm() {
  const form = $('#profile-form');
  const me = getMe();
  if (me) {
    $('#me-name').value = me.name || '';
    $('#me-age').value = me.age || '';
    $('#me-bio').value = me.bio || '';
    $('#me-photo').value = me.photo || '';
  }
  form.addEventListener('submit', (e)=> {
    e.preventDefault();
    const data = {
      name: $('#me-name').value.trim(),
      age: parseInt($('#me-age').value || '0', 10),
      bio: $('#me-bio').value.trim(),
      photo: $('#me-photo').value.trim() || 'assets/placeholder.jpg'
    };
    saveMe(data);
    alert('Profile saved locally!');
  });
}

// PWA
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(console.warn);
    });
  }
}

async function init() {
  bindNav();
  bindActions();
  bindProfileForm();
  await loadProfiles();
  nextCard();
  registerSW();
}

init();
