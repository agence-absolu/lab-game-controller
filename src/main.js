import './style.css';

// Réglages du pilotage à la manette
const DEADZONE = 0.12; // zone morte des sticks
const SPEED = 900; // px/s, stick gauche à fond
const FINE_SPEED = 200; // px/s, stick droit à fond (précision)

// Boutons qui posent une marque : A / ✕ et RT / R2
const MARK_BUTTONS = [0, 7];

// Vibration déclenchée à la pose d'une marque
const RUMBLE = {
  duration: 200, // ms
  strongMagnitude: 0, // gros moteur (basses fréquences) coupé, de 0 à 1
  weakMagnitude: 1, // petit moteur (hautes fréquences), de 0 à 1
};

// Libellés des boutons au mapping « standard » : l'ordre des index est le même
// pour toutes les manettes, seuls les noms changent selon la marque.
const PROFILES = {
  xbox: {
    name: 'Xbox',
    labels: [
      'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
      'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox',
    ],
  },
  playstation: {
    name: 'PlayStation',
    labels: [
      '✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2',
      'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'Pavé',
    ],
  },
};

// Identifiant fabricant USB (Microsoft 045e, Sony 054c) ou nom du modèle selon
// le navigateur. Xbox est testé en premier : son id contient souvent aussi
// « Wireless Controller », comme celui des manettes Sony.
const XBOX_ID = /045e|xbox|xinput/i;
const PLAYSTATION_ID = /054c|dualsense|dualshock|playstation|wireless controller/i;

function detectProfile(id) {
  if (XBOX_ID.test(id)) return PROFILES.xbox;
  if (PLAYSTATION_ID.test(id)) return PROFILES.playstation;
  return PROFILES.xbox;
}

const cursor = document.querySelector('.cursor');
const $source = document.querySelector('[data-source]');
const $pad = document.querySelector('[data-pad]');
const $pos = document.querySelector('[data-pos]');
const $buttons = document.querySelector('[data-buttons]');
const $hint = document.querySelector('[data-hint]');
const $rumble = document.querySelector('[data-rumble]');
const $sticks = [...document.querySelectorAll('[data-stick] span')];

const pos = { x: innerWidth / 2, y: innerHeight / 2 };
let source = 'souris';
let padIndex = null;
let previousButtons = [];
let lastTime = performance.now();
let draggedMark = null; // marque suivie tant que son bouton reste enfoncé
let dragButton = null; // bouton qui a posé cette marque

function setSource(next) {
  if (source === next) return;
  source = next;
  $source.textContent = next;
  cursor.classList.toggle('is-pad', next === 'manette');
}

function render() {
  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  $pos.textContent = `${Math.round(pos.x)} × ${Math.round(pos.y)}`;
}

function clamp() {
  pos.x = Math.min(Math.max(pos.x, 0), innerWidth);
  pos.y = Math.min(Math.max(pos.y, 0), innerHeight);
}

// Pose une marque à l'emplacement du curseur
function mark() {
  const el = document.createElement('div');
  el.className = 'mark';
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  el.style.color = source === 'manette' ? '#5fd068' : '#f2efe9';
  document.body.append(el);
  return el;
}

// Recale une marque sur la position du curseur
function moveMark(el) {
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
}

function clearMarks() {
  document.querySelectorAll('.mark').forEach((el) => el.remove());
  draggedMark = null;
}

function press(on) {
  cursor.classList.toggle('is-pressed', on);
}

// Applique la zone morte en conservant une réponse progressive au-delà
function axis(value) {
  const abs = Math.abs(value);
  if (abs < DEADZONE) return 0;
  return Math.sign(value) * ((abs - DEADZONE) / (1 - DEADZONE)) ** 2;
}

// --- Souris ---
addEventListener('pointermove', (e) => {
  pos.x = e.clientX;
  pos.y = e.clientY;
  setSource('souris');
  render();
});

addEventListener('pointerdown', (e) => {
  setSource('souris');
  if (e.button === 0) {
    press(true);
    mark();
  } else if (e.button === 2) {
    clearMarks();
  }
});

addEventListener('pointerup', () => press(false));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', () => {
  clamp();
  render();
});

// --- Manette ---
addEventListener('gamepadconnected', (e) => {
  padIndex = e.gamepad.index;
  const { name, labels } = detectProfile(e.gamepad.id);
  $pad.textContent = `${name} — ${e.gamepad.id}`;
  $pad.title = e.gamepad.id;
  $buttons.innerHTML = e.gamepad.buttons
    .map((_, i) => `<li>${labels[i] ?? i}</li>`)
    .join('');
  setHint(labels);
  $rumble.textContent = rumbleSupport(e.gamepad);
});

addEventListener('gamepaddisconnected', (e) => {
  if (e.gamepad.index !== padIndex) return;
  padIndex = null;
  previousButtons = [];
  draggedMark = null;
  $pad.textContent = 'aucune — appuie sur un bouton';
  $buttons.innerHTML = '';
  setHint(PROFILES.xbox.labels);
  $rumble.textContent = '—';
  setSource('souris');
});

function setHint(labels) {
  $hint.textContent =
    `Stick gauche : déplacer · Stick droit : précision · ${labels[0]} / ${labels[7]} / clic : marquer · ${labels[1]} / clic droit : effacer`;
}

// Indique si le navigateur expose la vibration pour cette manette
function rumbleSupport(pad) {
  const actuator = pad.vibrationActuator;
  if (!actuator?.playEffect) return 'non prise en charge par le navigateur';
  // `effects` n'existe que dans les navigateurs récents
  if (actuator.effects && !actuator.effects.includes('dual-rumble')) {
    return `dual-rumble absent (${actuator.effects.join(', ') || 'aucun effet'})`;
  }
  return 'disponible';
}

async function vibrate(pad) {
  const actuator = pad.vibrationActuator;
  if (!actuator?.playEffect) {
    $rumble.textContent = 'non prise en charge par le navigateur';
    return;
  }
  $rumble.textContent = `en cours (${RUMBLE.duration} ms)…`;
  try {
    // « complete » si l'effet est allé au bout, « preempted » s'il a été
    // interrompu par un nouvel effet
    const result = await actuator.playEffect('dual-rumble', RUMBLE);
    $rumble.textContent = result === 'complete' ? 'jouée' : `résultat : ${result}`;
  } catch (error) {
    $rumble.textContent = `erreur : ${error.message || error.name}`;
  }
}

function pollGamepad(dt) {
  if (padIndex === null) return;
  const pad = navigator.getGamepads()[padIndex];
  if (!pad) return;

  const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
  const dx = axis(lx) * SPEED + axis(rx) * FINE_SPEED;
  const dy = axis(ly) * SPEED + axis(ry) * FINE_SPEED;

  // Position brute des sticks dans le HUD
  $sticks[0].style.transform = `translate(${lx * 27}px, ${ly * 27}px)`;
  $sticks[1].style.transform = `translate(${rx * 27}px, ${ry * 27}px)`;

  const buttons = pad.buttons.map((b) => b.pressed);
  buttons.forEach((on, i) => $buttons.children[i]?.classList.toggle('is-on', on));
  const justPressed = (i) => buttons[i] && !previousButtons[i];
  const anyPressed = buttons.some(Boolean);

  if (dx || dy || anyPressed) setSource('manette');

  if (dx || dy) {
    pos.x += dx * dt;
    pos.y += dy * dt;
    clamp();
    render();
    if (draggedMark) moveMark(draggedMark);
  }

  if (draggedMark && !buttons[dragButton]) draggedMark = null;
  const markButton = MARK_BUTTONS.find(justPressed);
  if (markButton !== undefined) {
    draggedMark = mark();
    dragButton = markButton;
    vibrate(pad);
  }
  if (justPressed(1)) clearMarks();
  if (source === 'manette') press(MARK_BUTTONS.some((i) => buttons[i]));

  previousButtons = buttons;
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  pollGamepad(dt);
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
