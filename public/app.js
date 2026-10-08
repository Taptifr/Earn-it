const $ = s => document.querySelector(s);
const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) x.startsWith('on') ? e[x] = v : x === 'class' ? e.className = v : e.setAttribute(x, v); e.append(...k.flat().filter(c => c != null)); return e; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toDateString();

const TRAITS = [
  ['I start ten things and finish two', 'dreamer'], ['I want results now, not later', 'sprinter'],
  ['I overthink before I begin', 'perfectionist'], ['I get bored fast', 'sprinter'],
  ['It has to be perfect or I stall', 'perfectionist'], ['Big dreams, no plan', 'dreamer'],
  ['I work in bursts, then vanish', 'drifter'], ['My phone wins every fight', 'drifter'],
  ['Rewards move me', 'sprinter'], ['I hate being told what to do', 'drifter'],
  ['I live in my head', 'dreamer'], ['I redo things until they feel right', 'perfectionist']];
const READ = {
  dreamer: 'Dreamer. Your head is a studio. We build the landing strip.',
  sprinter: 'Sprinter. You need wins fast. We make them small and loud.',
  perfectionist: 'Perfectionist. Done beats flawless. This site will say so.',
  drifter: 'Drifter. You hate rules, so the rules here are yours.'};
const MODES = {
  strict: { name: 'Firm hand', mins: 25, blurb: 'Your next task is shouted at you. I nudge. You can still wander.',
    nudge: ['Your task is waiting. Open it.', 'Ten minutes now beats ten hours of guilt later.', 'Start badly. Just start.'] },
  iron: { name: 'Iron grip', mins: 40, blurb: 'Only one task is visible at a time. Leaving the tab costs you a slip.',
    nudge: ['You have one job. Do that job.', 'Everything else is hidden on purpose.', 'Slips are adding up. Focus.'] },
  vv: { name: 'Point of no return', mins: 50, blurb: 'Full-screen lock. Leave and the timer restarts. Done tasks stay done.',
    nudge: ['No exits. Start the session.', 'You chose this level. Honor it.', 'The lock is ready when you are.'] }};

let s = null, sess = null, pending = '';
const key = () => s.profile.name.trim().toLowerCase();
const mode = () => MODES[s.profile.mode];
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, 3500); };
const show = id => ['intro', 'strict', 'home'].forEach(x => $('#s-' + x).hidden = x !== id);
const theme = t => document.body.dataset.theme = t;
const save = () => fetch('/api/profile/' + encodeURIComponent(key()), { method: 'PUT', body: JSON.stringify(s) }).catch(() => toast('Could not reach the server. Is it running?'));

// ---------- Intro: identity + personality ----------
let picked = [];
TRAITS.forEach(([txt, type], i) => $('#traits').append(h('label', {}, h('input', { type: 'checkbox', value: i, onchange: readMe }), txt)));
function archetype() {
  const sc = {}; picked.forEach(i => sc[TRAITS[i][1]] = (sc[TRAITS[i][1]] || 0) + 1);
  return Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
}
function readMe() {
  picked = [...document.querySelectorAll('#traits input:checked')].map(c => +c.value);
  const a = archetype(); if (a) { theme(a); $('#read').textContent = READ[a]; } else $('#read').textContent = "Pick a few and I'll read you.";
}
$('#go-strict').onclick = () => {
  const name = $('#in-name').value.trim();
  if (!name) return $('#intro-err').textContent = 'Add your name first.';
  if (!picked.length) return $('#intro-err').textContent = 'Pick at least one trait so I can theme the site.';
  $('#intro-err').textContent = '';
  s = { profile: { name, age: $('#in-age').value, traits: picked.map(i => TRAITS[i][0]), theme: archetype(), mode: 'strict' },
    tasks: [], goals: [], rewards: ['Watch one episode, guilt free', 'A movie tonight', '30 minutes of shopping', 'Coffee outside', 'One hour of gaming'],
    wallet: [], slips: 0, date: today() };
  show('strict');
};
$('#load').onclick = async () => {
  const name = $('#in-name').value.trim(); if (!name) return $('#intro-err').textContent = 'Type the name you signed with.';
  const r = await fetch('/api/profile/' + encodeURIComponent(name.toLowerCase())).catch(() => null);
  if (!r || !r.ok) return $('#intro-err').textContent = 'No profile under that name yet. Build one instead.';
  s = await r.json(); enter();
};

// ---------- Strictness ----------
Object.entries(MODES).forEach(([k, m]) => $('#modes').append(h('button', { onclick: () => { s.profile.mode = k; save(); enter(); } }, h('b', {}, m.name), h('span', {}, m.blurb))));
$('#chg').onclick = () => { if (sess) return toast('Finish your session first.'); show('strict'); };

// ---------- Home ----------
function enter() {
  if (s.date !== today()) { s.date = today(); s.goals.forEach(g => { g.min = 0; g.hit = false; }); }
  theme(s.profile.theme); document.body.dataset.mode = s.profile.mode; show('home'); save(); render();
}
function render() {
  const p = s.profile, undone = s.tasks.filter(t => !t.done), now = undone[0];
  $('#hi').textContent = 'Hey ' + p.name + '.';
  $('#mode-badge').textContent = mode().name; $('#slips').textContent = s.slips + (s.slips === 1 ? ' slip' : ' slips');
  const nowBox = $('#now'); nowBox.replaceChildren(now
    ? [h('div', { class: 'tag' }, 'Right now'), h('div', { class: 'big-t' }, now.text), h('button', { class: 'big', onclick: () => startSession(now.text) }, 'Start ' + mode().mins + ' min focus')]
    : [h('div', { class: 'big-t' }, s.tasks.length ? 'Everything is done. Go collect.' : 'Nothing on deck.'), h('div', { class: 'tag' }, s.tasks.length ? 'Check your coupons below.' : 'Add what you will do today. I will take it from there.')]);

  $('#tasks').replaceChildren(...s.tasks.map(t => h('li', { class: (t.done ? 'done ' : '') + (p.mode !== 'strict' && !t.done && t !== now ? 'dim' : '') },
    h('input', { type: 'checkbox', ...(t.done ? { checked: '' } : {}), onchange: () => toggle(t) }), h('span', {}, t.text),
    p.mode === 'vv' && t.done ? null : h('button', { class: 'x', onclick: () => { s.tasks = s.tasks.filter(x => x !== t); save(); render(); } }, '✕'))));

  $('#goals').replaceChildren(...s.goals.map(g => { const pct = Math.min(100, Math.round(g.min / g.target * 100));
    return h('div', { class: 'goal' }, h('b', {}, g.text), h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })),
      h('p', {}, g.hit ? 'Quota hit. You earned today.' : g.min + ' of ' + g.target + ' min done. ' + (g.target - g.min) + ' to go.'),
      h('button', { onclick: () => startSession(g.text, g) }, 'Start ' + mode().mins + ' min session'),
      h('button', { class: 'x', onclick: () => { s.goals = s.goals.filter(x => x !== g); save(); render(); } }, 'remove')); }));

  $('#wallet').replaceChildren(...(s.wallet.length ? s.wallet.map(c => h('div', { class: 'coupon' }, h('div', {}, h('small', {}, c.why), h('b', {}, c.text)),
    h('button', { onclick: () => { s.wallet = s.wallet.filter(x => x !== c); save(); render(); toast('Enjoy it. You earned it.'); } }, 'Redeem'))) : [h('p', { class: 'hint' }, 'Empty. Finish a task and one lands here.')]));

  $('#rewards').replaceChildren(...s.rewards.map((r, i) => h('li', {}, h('span', {}, r), h('button', { class: 'x', onclick: () => { s.rewards.splice(i, 1); save(); render(); } }, '✕'))));
}
function toggle(t) {
  if (t.done && s.profile.mode === 'vv') { toast('No take-backs at this level.'); return render(); }
  t.done = !t.done; save(); render(); if (t.done) ticket('Task done: ' + t.text);
}
function ticket(why) {
  if (!s.rewards.length) return toast('Add something to your reward menu first.');
  const text = s.rewards[Math.floor(Math.random() * s.rewards.length)];
  s.wallet.push({ id: uid(), text, why }); save(); render();
  const d = $('#tk'); d.replaceChildren(h('div', {}, 'You earned it'), h('h3', {}, text), h('button', { class: 'big', onclick: () => d.close() }, 'Add to my coupons'));
  d.showModal();
}
$('#f-task').onsubmit = e => { e.preventDefault(); s.tasks.push({ id: uid(), text: $('#t-in').value.trim(), done: false }); e.target.reset(); save(); render(); };
$('#f-goal').onsubmit = e => { e.preventDefault(); s.goals.push({ id: uid(), text: $('#g-in').value.trim(), target: +$('#g-t').value, min: 0, hit: false }); e.target.reset(); save(); render(); };
$('#f-rw').onsubmit = e => { e.preventDefault(); s.rewards.push($('#r-in').value.trim()); e.target.reset(); save(); render(); };

// ---------- Focus sessions ----------
function startSession(label, goal) {
  sess = { label, goal, end: Date.now() + mode().mins * 60000, done: false };
  $('#lk-mode').textContent = mode().name; $('#lk-label').textContent = label;
  $('#lk-msg').textContent = s.profile.mode === 'vv' ? 'Leave this tab and the timer restarts.' : 'Stay on this tab. Nothing else exists right now.';
  $('#lk-done').hidden = true; $('#lk-quit').hidden = false; $('#lock').hidden = false; tick();
}
function tick() {
  if (!sess || sess.done) return;
  const left = sess.end - Date.now();
  if (left <= 0) {
    sess.done = true; $('#lk-time').textContent = '00:00'; $('#lk-msg').textContent = 'Session complete. That counts.';
    $('#lk-done').hidden = false; $('#lk-quit').hidden = true;
    if (sess.goal) { const g = sess.goal; g.min += mode().mins; if (g.min >= g.target && !g.hit) { g.hit = true; save(); render(); ticket('Daily quota hit: ' + g.text); } else { save(); render(); } }
    return;
  }
  const m = Math.floor(left / 60000), sec = Math.floor(left % 60000 / 1000);
  $('#lk-time').textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  document.title = $('#lk-time').textContent + ' · Earn It';
}
setInterval(tick, 500);
$('#lk-done').onclick = () => { sess = null; $('#lock').hidden = true; document.title = 'Earn It'; };
$('#lk-quit').onclick = () => { if (confirm('Quit now? This costs you a slip.')) { s.slips++; save(); sess = null; $('#lock').hidden = true; document.title = 'Earn It'; render(); } };

// ---------- Strictness enforcement ----------
document.addEventListener('visibilitychange', () => {
  if (!s) return;
  if (document.hidden) {
    if (s.profile.mode === 'strict') return;
    s.slips++; save(); pending = 'You left the tab. Slip logged.';
    if (sess && !sess.done && s.profile.mode === 'vv') { sess.end = Date.now() + mode().mins * 60000; pending = 'You left. Timer restarted from the top.'; }
  } else if (pending) { render(); toast(pending); pending = ''; }
});
setInterval(() => {
  if (!s || sess || $('#s-home').hidden || !s.tasks.some(t => !t.done)) return;
  const n = mode().nudge; toast(n[Math.floor(Math.random() * n.length)]);
}, 75000);
