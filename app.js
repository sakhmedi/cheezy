/* =========================================================
   CHEEZY — app.js
   Plain JavaScript, no libraries.
     1. Data   2. State   3. DOM references   4. Rendering
     5. Drag-and-drop   6. Price calculation   7. Order & form   8. Init
   ========================================================= */
"use strict";

/* =========================================================
   1. DATA
   ========================================================= */
// To add a topping, add ONE line. icon "" = drawn with CSS (.shape--<id>).
const INGREDIENTS = [
  { photo: "assets/ingredients/mozzarella.png", id: "mozzarella", name: "Mozzarella",   icon: "",   price: 1.00, type: "cheese" },
  { photo: "assets/ingredients/pepperoni.png", id: "pepperoni",  name: "Pepperoni",    icon: "",   price: 1.50, type: "meat" },
  { photo: "assets/ingredients/mushrooms.png", id: "mushrooms",  name: "Mushrooms",    icon: "",   price: 1.00, type: "veg" },
  { photo: "assets/ingredients/peppers.png", id: "peppers",    name: "Bell peppers", icon: "",   price: 1.00, type: "veg" },
  { photo: "assets/ingredients/onions.png", id: "onions",     name: "Onions",       icon: "",   price: 0.75, type: "veg" },
  { photo: "assets/ingredients/olives.png", id: "olives",     name: "Black olives", icon: "",   price: 1.00, type: "veg" },
  { photo: "assets/ingredients/ham.png", id: "ham",        name: "Ham",          icon: "",   price: 1.50, type: "meat" },
  { photo: "assets/ingredients/bacon.png", id: "bacon",      name: "Bacon",        icon: "",   price: 1.75, type: "meat" },
  { photo: "assets/ingredients/pineapple.png", id: "pineapple",  name: "Pineapple",    icon: "",   price: 1.00, type: "fruit" },
  { photo: "assets/ingredients/corn.png", id: "corn",       name: "Sweet corn",   icon: "",   price: 0.75, type: "veg" },
  { photo: "assets/ingredients/tomatoes.png", id: "tomatoes",   name: "Tomatoes",     icon: "",   price: 0.75, type: "veg" },
  { photo: "assets/ingredients/basil.png", id: "basil",      name: "Fresh basil",  icon: "",   price: 0.50, type: "veg" },
  { photo: "assets/ingredients/jalapenos.png", id: "jalapenos",  name: "Jalapeños",    icon: "",   price: 0.75, type: "veg" },
  { photo: "assets/ingredients/chicken.png", id: "chicken",    name: "Chicken",      icon: "",   price: 1.75, type: "meat" },
];
const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

const SIZES = {
  small:  { label: "Small",  cm: 25, price: 8 },
  medium: { label: "Medium", cm: 30, price: 11 },
  large:  { label: "Large",  cm: 35, price: 14 },
};
// innerRadius: how far from centre a topping may sit (fraction of pizza width).
const CRUSTS = {
  classic: { label: "Classic",        price: 0, innerRadius: 0.41 },
  thin:    { label: "Thin",           price: 0, innerRadius: 0.44 },
  stuffed: { label: "Cheese-stuffed", price: 2, innerRadius: 0.385 },
};
const SAUCES = { tomato: { label: "Tomato" }, garlic: { label: "White garlic" }, bbq: { label: "BBQ" } };

const MAX_TOPPINGS = 40;
const DELIVERY_FEE = 2.5;
const FREE_DELIVERY_FROM = 25;
const MAX_QUANTITY = 10;
const STORAGE_KEY = "nonna-byte-pizza-v1";
const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 650;
const CHALLENGE_SECONDS = 60;

const ACHIEVEMENTS = [
  { id: "meat",      icon: "beef", title: "Meat Lover",        text: "3+ meat toppings",      test: (c) => c.byType.meat >= 3 },
  { id: "veggie",    icon: "carrot", title: "Veggie Hero",       text: "4+ vegetable toppings", test: (c) => c.byType.veg >= 4 },
  { photo: "assets/ingredients/pineapple.png", id: "pineapple", icon: "crown", title: "Pineapple Warrior", text: "You went there.",       test: (c) => (c.byId.pineapple || 0) >= 1 },
  { id: "cheese",    icon: "award", title: "Cheese Master",     text: "Mozzarella ×3",         test: (c) => (c.byId.mozzarella || 0) >= 3 },
];

/* =========================================================
   2. STATE
   ========================================================= */
function createDefaultState() {
  return { size: "medium", crust: "classic", sauce: "tomato", toppings: [] };
}

let state = loadState();
const history = [];
const HISTORY_LIMIT = 60;

const ui = {
  quantity: 1,
  selectedToppingId: null,
  newToppingIds: new Set(),
  unlocked: new Set(),
  soundOn: false,
  shownPrice: 0,
  priceFrame: 0,
  drag: null,
  challenge: null,
  isPlacingOrder: false,
};

let nextToppingId = state.toppings.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;

function loadState() {
  try { return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (e) { return createDefaultState(); }
}

function sanitizeState(saved) {
  const fresh = createDefaultState();
  if (!saved || typeof saved !== "object") return fresh;
  return {
    size: SIZES[saved.size] ? saved.size : fresh.size,
    crust: CRUSTS[saved.crust] ? saved.crust : fresh.crust,
    sauce: SAUCES[saved.sauce] ? saved.sauce : fresh.sauce,
    toppings: Array.isArray(saved.toppings)
      ? saved.toppings.filter((t) => t && INGREDIENT_BY_ID.has(t.ingredientId) && Number.isFinite(t.x) && Number.isFinite(t.y)).slice(0, MAX_TOPPINGS)
      : [],
  };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: app still works */ }
}

const cloneState = (s) => JSON.parse(JSON.stringify(s));

function pushHistory() {
  history.push(cloneState(state));
  if (history.length > HISTORY_LIMIT) history.shift();
}

// The ONE way to change the pizza: remember → change → save → redraw.
function updateState(changeFn, options = { saveHistory: true }) {
  if (options.saveHistory) pushHistory();
  changeFn(state);
  saveState();
  render();
}

/* =========================================================
   3. DOM REFERENCES
   ========================================================= */
const $ = (id) => document.getElementById(id);
const dom = {};
[
  "pizza", "board", "toppingsLayer", "particles", "tray", "dropHint", "toppingCount",
  "undoBtn", "clearBtn", "surpriseBtn", "soundBtn", "challengeBtn", "challengeCard", "challengeTimer", "challengeList",
  "priceValue", "mobileTotal", "mobileBar", "scoreValue", "scoreFill", "scoreBar", "scoreLabel",
  "trash", "toasts", "liveRegion", "confetti", "orderView", "snapshot", "sumSize", "sumCrust", "sumSauce", "sumToppings",
  "qtyMinus", "qtyPlus", "qtyValue", "bdBase", "bdCrust", "bdToppings", "bdPerPizza", "bdQty", "bdSubtotal", "bdDelivery", "bdTotal",
  "orderForm", "confirmDialog", "confirmTotal", "cancelOrderBtn", "placeOrderBtn",
  "successView", "successNumber", "successEta", "successSummary", "buildAnotherBtn",
].forEach((id) => { dom[id] = $(id); });
dom.orderSection = $("order");
dom.timeInput = $("fTime");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* =========================================================
   4. RENDERING (reads state, never changes it)
   ========================================================= */
function render() {
  renderPizzaBase();
  renderToppings();
  renderControls();
  animatePrice(calculatePizzaPrice().perPizza);
  renderScore();
  renderOrderSummary();
  renderChallenge();
  checkAchievements();
}

function renderPizzaBase() {
  dom.pizza.dataset.size = state.size;
  dom.pizza.dataset.crust = state.crust;
  dom.pizza.dataset.sauce = state.sauce;
  for (const name of ["size", "crust", "sauce"]) {
    const input = document.querySelector(`input[name="${name}"][value="${state[name]}"]`);
    if (input) input.checked = true;
  }
}

function createPieceVisual(ingredient) {
  const piece = document.createElement("span");
  piece.className = "piece";
  if (ingredient.photo) {
    const img = document.createElement("img");
    img.src = ingredient.photo;
    img.alt = "";
    img.draggable = false;
    piece.appendChild(img);
    piece.classList.add("piece--photo");
  } else if (ingredient.icon) {
    piece.textContent = ingredient.icon;
  } else {
    const shape = document.createElement("span");
    shape.className = `shape shape--${ingredient.id}`;
    piece.appendChild(shape);
  }
  return piece;
}

function createToppingElement(topping) {
  const ingredient = INGREDIENT_BY_ID.get(topping.ingredientId);
  const el = document.createElement("div");
  el.className = "placed";
  el.dataset.toppingId = topping.id;
  el.style.left = `${topping.x * 100}%`;
  el.style.top = `${topping.y * 100}%`;
  el.style.setProperty("--rotation", `${topping.rotation}deg`);
  el.style.setProperty("--scale", topping.scale);
  if (ui.newToppingIds.has(topping.id)) el.classList.add("is-new");
  if (ui.selectedToppingId === topping.id) el.classList.add("is-selected");
  el.appendChild(createPieceVisual(ingredient));
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "piece-remove";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", `Remove ${ingredient.name}`);
  el.appendChild(removeBtn);
  return el;
}

function renderToppings() {
  dom.toppingsLayer.replaceChildren(...state.toppings.map(createToppingElement));
  ui.newToppingIds.clear();
}

function renderControls() {
  const count = state.toppings.length;
  dom.undoBtn.disabled = history.length === 0;
  dom.clearBtn.disabled = count === 0;
  dom.surpriseBtn.disabled = count >= MAX_TOPPINGS;
  dom.toppingCount.textContent = `${count} / ${MAX_TOPPINGS} toppings`;
  dom.toppingCount.classList.toggle("is-full", count >= MAX_TOPPINGS);
}

function animatePrice(target) {
  cancelAnimationFrame(ui.priceFrame);
  const start = ui.shownPrice;
  const duration = prefersReducedMotion.matches ? 0 : 400;
  const t0 = performance.now();
  const step = (now) => {
    const p = duration === 0 ? 1 : Math.min((now - t0) / duration, 1);
    ui.shownPrice = start + (target - start) * p;
    dom.priceValue.textContent = formatPrice(ui.shownPrice);
    dom.mobileTotal.textContent = formatPrice(ui.shownPrice);
    if (p < 1) ui.priceFrame = requestAnimationFrame(step);
  };
  ui.priceFrame = requestAnimationFrame(step);
}

function renderScore() {
  const score = calculateScore();
  dom.scoreValue.textContent = score;
  dom.scoreFill.style.width = `${score}%`;
  dom.scoreBar.setAttribute("aria-valuenow", score);
  dom.scoreLabel.textContent =
    score === 0 ? "Empty canvas" : score < 40 ? "Getting started" : score < 70 ? "Looking tasty" : score < 90 ? "Chef's kiss" : "Pizza legend";
}

function countToppings() {
  const counts = {};
  for (const t of state.toppings) counts[t.ingredientId] = (counts[t.ingredientId] || 0) + 1;
  return counts;
}

function renderOrderSummary() {
  const size = SIZES[state.size];
  dom.sumSize.textContent = `${size.label} (${size.cm} cm)`;
  dom.sumCrust.textContent = CRUSTS[state.crust].label;
  dom.sumSauce.textContent = SAUCES[state.sauce].label;

  const counts = countToppings();
  const items = Object.keys(counts).map((id) => {
    const li = document.createElement("li");
    li.textContent = `${INGREDIENT_BY_ID.get(id).name} ×${counts[id]}`;
    return li;
  });
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No toppings yet. A classic Margherita base!";
    items.push(li);
  }
  dom.sumToppings.replaceChildren(...items);
  renderBreakdown();
  renderSnapshot();
}

function renderBreakdown() {
  const price = calculatePizzaPrice();
  const order = calculateOrderTotal(ui.quantity);
  dom.qtyValue.textContent = ui.quantity;
  dom.qtyMinus.disabled = ui.quantity <= 1;
  dom.qtyPlus.disabled = ui.quantity >= MAX_QUANTITY;
  dom.bdBase.textContent = formatPrice(price.base);
  dom.bdCrust.textContent = formatPrice(price.crustExtra);
  dom.bdToppings.textContent = formatPrice(price.toppingsTotal);
  dom.bdPerPizza.textContent = formatPrice(price.perPizza);
  dom.bdQty.textContent = `(×${ui.quantity})`;
  dom.bdSubtotal.textContent = formatPrice(order.subtotal);
  dom.bdDelivery.textContent = order.delivery === 0 ? "Free" : formatPrice(order.delivery);
  dom.bdTotal.textContent = formatPrice(order.total);
}

function renderSnapshot() {
  const copy = dom.pizza.cloneNode(true);
  copy.removeAttribute("id");
  copy.querySelectorAll(".piece-remove, .particles").forEach((el) => el.remove());
  copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  copy.querySelectorAll(".is-new, .is-selected, .is-lifted").forEach((el) => el.classList.remove("is-new", "is-selected", "is-lifted"));
  dom.snapshot.replaceChildren(copy);
}

/* ---------- Toasts, hints, announcements ---------- */
function showToast(title, text, icon = "pizza") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true"></span><div><strong></strong><span></span></div>`;
  toast.querySelector(".toast-icon").innerHTML = `<i data-lucide="${icon}"></i>`;
  toast.querySelector("strong").textContent = title;
  toast.querySelector("div span").textContent = text;
  dom.toasts.appendChild(toast);
  refreshIcons();
  setTimeout(() => toast.classList.add("is-leaving"), 2800);
  setTimeout(() => toast.remove(), 3200);
}

let dropHintTimer = 0;
function showDropHint() {
  dom.dropHint.classList.add("is-visible");
  clearTimeout(dropHintTimer);
  dropHintTimer = setTimeout(() => dom.dropHint.classList.remove("is-visible"), 1600);
}

function announce(message) {
  dom.liveRegion.textContent = "";
  requestAnimationFrame(() => { dom.liveRegion.textContent = message; });
}

/* ---------- Visual effects ---------- */
function spawnSparkles(x, y) {
  if (prefersReducedMotion.matches) return;
  const colors = ["#FFD166", "#FFFFFF", "#F4A261", "#2E7D32"];
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 8;
    spark.className = "spark";
    spark.style.left = `${x * 100}%`;
    spark.style.top = `${y * 100}%`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * 7}cqw`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * 7}cqw`);
    spark.style.setProperty("--spark-color", colors[i % colors.length]);
    dom.particles.appendChild(spark);
    setTimeout(() => spark.remove(), 650);
  }
}

function launchConfetti() {
  if (prefersReducedMotion.matches) return;
  const colors = ["#D62828", "#F4A261", "#2E7D32", "#FFD166", "#FFFFFF"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--delay", `${Math.random() * 0.6}s`);
    piece.style.setProperty("--duration", `${2 + Math.random() * 1.5}s`);
    piece.style.setProperty("--drift", `${randomBetween(-120, 120)}px`);
    piece.style.setProperty("--spin", `${randomBetween(360, 1080)}deg`);
    dom.confetti.appendChild(piece);
    setTimeout(() => piece.remove(), 4500);
  }
}

/* ---------- Sound (Web Audio, no files; off by default) ---------- */
let audioContext = null;
function playSound(type) {
  if (!ui.soundOn) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const pop = type === "pop";
    osc.type = pop ? "sine" : "triangle";
    osc.frequency.setValueAtTime(pop ? 660 : 500, now);
    osc.frequency.exponentialRampToValueAtTime(pop ? 220 : 90, now + (pop ? 0.12 : 0.25));
    gain.gain.setValueAtTime(pop ? 0.25 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (pop ? 0.15 : 0.3));
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch (e) { /* audio unavailable */ }
}

function toggleSound() {
  ui.soundOn = !ui.soundOn;
  dom.soundBtn.setAttribute("aria-pressed", String(ui.soundOn));
  setButton(dom.soundBtn, ui.soundOn ? "volume-2" : "volume-x", "");
  playSound("pop");
}

/* ---------- Pizza Score (fun only, never affects price) ---------- */
function calculateScore() {
  const toppings = state.toppings;
  if (toppings.length === 0) return 0;
  const variety = (Math.min(Object.keys(countToppings()).length, 5) / 5) * 45;
  const quarters = [0, 0, 0, 0];
  for (const t of toppings) quarters[(t.x < 0.5 ? 0 : 1) + (t.y < 0.5 ? 0 : 2)]++;
  const ideal = toppings.length / 4;
  const deviation = quarters.reduce((sum, q) => sum + Math.abs(q - ideal), 0);
  const spread = (1 - deviation / (toppings.length * 1.5)) * 35;
  const n = toppings.length;
  const amount = (n < 8 ? n / 8 : n <= 30 ? 1 : 1 - ((n - 30) / (MAX_TOPPINGS - 30)) * 0.5) * 20;
  return Math.round(variety + spread + amount);
}

/* ---------- Achievements ---------- */
function checkAchievements() {
  const byId = countToppings();
  const byType = { meat: 0, veg: 0, cheese: 0, fruit: 0 };
  for (const t of state.toppings) byType[INGREDIENT_BY_ID.get(t.ingredientId).type]++;
  for (const a of ACHIEVEMENTS) {
    if (!ui.unlocked.has(a.id) && a.test({ byId, byType })) {
      ui.unlocked.add(a.id);
      showToast(`Badge: ${a.title}`, a.text, a.icon);
    }
  }
}

/* ---------- Challenge mode ---------- */
function startChallenge() {
  if (ui.challenge) { stopChallenge(); return; }
  const pool = [...INGREDIENTS].sort(() => Math.random() - 0.5).slice(0, 3);
  ui.challenge = {
    goals: pool.map((i) => ({ id: i.id, count: Math.floor(randomBetween(1, 4)) })),
    secondsLeft: CHALLENGE_SECONDS,
    timer: setInterval(tickChallenge, 1000),
  };
  dom.challengeBtn.setAttribute("aria-pressed", "true");
  setButton(dom.challengeBtn, "square", "Stop");
  dom.challengeCard.hidden = false;
  renderChallenge();
  announce("Challenge started. Build the customer's pizza in 60 seconds.");
}

function tickChallenge() {
  if (!ui.challenge) return;
  ui.challenge.secondsLeft--;
  dom.challengeTimer.textContent = `${ui.challenge.secondsLeft}s`;
  if (ui.challenge.secondsLeft <= 0) {
    stopChallenge();
    showToast("Time's up!", "The customer got hungry. Try again?", "timer");
  }
}

function stopChallenge() {
  if (!ui.challenge) return;
  clearInterval(ui.challenge.timer);
  ui.challenge = null;
  dom.challengeBtn.setAttribute("aria-pressed", "false");
  setButton(dom.challengeBtn, "timer", "Challenge");
  dom.challengeCard.hidden = true;
}

function renderChallenge() {
  if (!ui.challenge) return;
  const counts = countToppings();
  let allDone = true;
  const items = ui.challenge.goals.map((g) => {
    const have = counts[g.id] || 0;
    const done = have >= g.count;
    if (!done) allDone = false;
    const li = document.createElement("li");
    li.className = done ? "is-done" : "";
    li.textContent = `${done ? "✓ " : ""}${INGREDIENT_BY_ID.get(g.id).name} ${Math.min(have, g.count)}/${g.count}`;
    return li;
  });
  dom.challengeList.replaceChildren(...items);
  dom.challengeTimer.textContent = `${ui.challenge.secondsLeft}s`;
  if (allDone) {
    const time = CHALLENGE_SECONDS - ui.challenge.secondsLeft;
    stopChallenge();
    launchConfetti();
    showToast("Order up!", `Done in ${time} seconds.`, "trophy");
  }
}

/* =========================================================
   5. DRAG-AND-DROP (Pointer Events: mouse, touch and pen)
   pointerdown → move past threshold → drag → pointerup (drop)
   ========================================================= */

/* ---------- Topping actions ---------- */
// x, y are fractions of the pizza (0–1), so toppings survive size changes.
function placeTopping(ingredientId, x, y, options = { saveHistory: true }) {
  if (state.toppings.length >= MAX_TOPPINGS) {
    showToast("Pizza is full!", `${MAX_TOPPINGS} toppings max, or it won't fit in the oven.`, "flame");
    announce(`Pizza is full. Maximum ${MAX_TOPPINGS} toppings.`);
    return false;
  }
  const topping = {
    id: nextToppingId++,
    ingredientId, x, y,
    rotation: Math.round(randomBetween(-180, 180)),
    scale: Number(randomBetween(0.85, 1.15).toFixed(2)),
  };
  ui.newToppingIds.add(topping.id);
  updateState((s) => s.toppings.push(topping), options);
  spawnSparkles(x, y);
  playSound("pop");
  announceChange(`${INGREDIENT_BY_ID.get(ingredientId).name} added.`);
  return true;
}

function moveTopping(toppingId, x, y) {
  updateState((s) => {
    const t = s.toppings.find((t) => t.id === toppingId);
    if (t) { t.x = x; t.y = y; }
  });
}

function removeTopping(toppingId) {
  const topping = state.toppings.find((t) => t.id === toppingId);
  if (!topping) return;
  if (ui.selectedToppingId === toppingId) ui.selectedToppingId = null;
  updateState((s) => { s.toppings = s.toppings.filter((t) => t.id !== toppingId); });
  playSound("swoosh");
  announceChange(`${INGREDIENT_BY_ID.get(topping.ingredientId).name} removed.`);
}

function announceChange(prefix) {
  const n = state.toppings.length;
  announce(`${prefix} ${n} ${n === 1 ? "topping" : "toppings"}, ${formatPrice(calculatePizzaPrice().perPizza)}.`);
}

function addToppingAtRandomSpot(ingredientId, options) {
  const spot = findFreeSpot();
  return placeTopping(ingredientId, spot.x, spot.y, options);
}

// Tries 15 random points, keeps the one with most space around it.
function findFreeSpot() {
  const radius = CRUSTS[state.crust].innerRadius - 0.04;
  let best = null, bestDistance = -1;
  for (let i = 0; i < 15; i++) {
    const p = randomPointInCircle(radius);
    const nearest = Math.min(1, ...state.toppings.map((t) => Math.hypot(t.x - p.x, t.y - p.y)));
    if (nearest > bestDistance) { best = p; bestDistance = nearest; }
  }
  return best;
}

function randomPointInCircle(radius) {
  const angle = Math.random() * Math.PI * 2;
  const d = radius * Math.sqrt(Math.random());
  return { x: 0.5 + Math.cos(angle) * d, y: 0.5 + Math.sin(angle) * d };
}

function undo() {
  if (history.length === 0) return;
  state = history.pop();
  ui.selectedToppingId = null;
  saveState();
  render();
  announceChange("Undone.");
}

function clearPizza() {
  if (state.toppings.length === 0) return;
  ui.selectedToppingId = null;
  updateState((s) => { s.toppings = []; });
  playSound("swoosh");
  announceChange("Pizza cleared.");
}

// Drops 6–10 random toppings one by one. Whole thing = ONE undo step.
function surpriseMe() {
  const amount = Math.min(MAX_TOPPINGS - state.toppings.length, Math.floor(randomBetween(6, 11)));
  if (amount <= 0) return;
  pushHistory();
  dom.surpriseBtn.disabled = true;
  const delay = prefersReducedMotion.matches ? 0 : 110;
  for (let i = 0; i < amount; i++) {
    setTimeout(() => {
      const ingredient = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
      addToppingAtRandomSpot(ingredient.id, { saveHistory: false });
      if (i === amount - 1) renderControls();
    }, i * delay);
  }
}

/* ---------- Geometry: where on the pizza is the pointer? ---------- */
// Returns { x, y } as pizza fractions, or null when outside the pizza.
// Points on the crust are nudged inward so toppings sit on the sauce.
function pointerToPizza(clientX, clientY) {
  const rect = dom.pizza.getBoundingClientRect(); // includes size scale
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const dx = x - 0.5, dy = y - 0.5;
  const distance = Math.hypot(dx, dy);
  if (distance > 0.5) return null;
  const limit = CRUSTS[state.crust].innerRadius - 0.02;
  if (distance <= limit) return { x, y };
  const k = limit / distance;
  return { x: 0.5 + dx * k, y: 0.5 + dy * k };
}

function isOverTrash(clientX, clientY) {
  if (!dom.trash.classList.contains("is-visible")) return false;
  const r = dom.trash.getBoundingClientRect();
  return clientX >= r.left - 10 && clientX <= r.right + 10 && clientY >= r.top - 10 && clientY <= r.bottom + 10;
}

/* ---------- Drag lifecycle ---------- */
// source: { kind: "tray", ingredientId, originEl } or { kind: "placed", toppingId, el }
function onPointerDown(event, source) {
  if (event.button !== 0 || ui.drag || ui.isPlacingOrder) return;
  ui.drag = {
    source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    ghost: null,
    longPress: 0,
  };
  if (source.kind === "placed") {
    ui.drag.longPress = setTimeout(() => {
      const id = source.toppingId;
      cancelDrag();
      if (navigator.vibrate) navigator.vibrate(30);
      removeTopping(id);
    }, LONG_PRESS_MS);
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", cancelDrag);
}

function startDrag() {
  const drag = ui.drag;
  clearTimeout(drag.longPress);
  drag.active = true;
  document.body.classList.add("is-dragging");
  const ingredientId = drag.source.kind === "tray"
    ? drag.source.ingredientId
    : state.toppings.find((t) => t.id === drag.source.toppingId).ingredientId;
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.appendChild(createPieceVisual(INGREDIENT_BY_ID.get(ingredientId)));
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  if (drag.source.kind === "placed") {
    drag.source.el.classList.add("is-lifted");
    dom.trash.classList.add("is-visible");
    ui.selectedToppingId = null;
  }
}

function onPointerMove(event) {
  const drag = ui.drag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
    startDrag();
  }
  event.preventDefault();
  drag.ghost.style.left = `${event.clientX}px`;
  drag.ghost.style.top = `${event.clientY}px`;
  const overTrash = isOverTrash(event.clientX, event.clientY);
  dom.trash.classList.toggle("is-hot", overTrash);
  dom.board.classList.toggle("is-drop-target", !overTrash && !!pointerToPizza(event.clientX, event.clientY));
}

function onPointerUp(event) {
  const drag = ui.drag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { source } = drag;

  // A press without movement = a tap/click.
  if (!drag.active) {
    endDrag();
    if (source.kind === "tray") {
      addToppingAtRandomSpot(source.ingredientId);
    } else if (!event.target.closest(".piece-remove")) {
      ui.selectedToppingId = ui.selectedToppingId === source.toppingId ? null : source.toppingId;
      renderToppings();
    }
    return;
  }

  const spot = pointerToPizza(event.clientX, event.clientY);
  const overTrash = isOverTrash(event.clientX, event.clientY);

  if (source.kind === "tray") {
    if (spot) {
      endDrag();
      placeTopping(source.ingredientId, spot.x, spot.y);
    } else {
      returnGhostTo(source.originEl);
      endDrag({ keepGhost: true });
      showDropHint();
    }
  } else if (overTrash || !spot) {
    endDrag();
    removeTopping(source.toppingId); // dragged off the pizza = removed
  } else {
    endDrag();
    moveTopping(source.toppingId, spot.x, spot.y);
  }
}

// Slides the ghost back to where it came from, then removes it.
function returnGhostTo(el) {
  const ghost = ui.drag.ghost;
  const r = el.getBoundingClientRect();
  ghost.classList.add("is-returning");
  requestAnimationFrame(() => {
    ghost.style.left = `${r.left + r.width / 2}px`;
    ghost.style.top = `${r.top + r.height / 2}px`;
  });
  setTimeout(() => ghost.remove(), 400);
}

function endDrag(options = {}) {
  const drag = ui.drag;
  if (!drag) return;
  clearTimeout(drag.longPress);
  if (drag.ghost && !options.keepGhost) drag.ghost.remove();
  if (drag.source.kind === "placed" && drag.source.el) drag.source.el.classList.remove("is-lifted");
  document.body.classList.remove("is-dragging");
  dom.board.classList.remove("is-drop-target");
  dom.trash.classList.remove("is-visible", "is-hot");
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", cancelDrag);
  ui.drag = null;
}

// Browser took over (e.g. tray scroll on touch) or Escape pressed: nothing changes.
function cancelDrag() { endDrag(); }

/* =========================================================
   6. PRICE CALCULATION (one place, used everywhere)
   ========================================================= */
function calculatePizzaPrice() {
  const base = SIZES[state.size].price;
  const crustExtra = CRUSTS[state.crust].price;
  const toppingsTotal = state.toppings.reduce((sum, t) => sum + INGREDIENT_BY_ID.get(t.ingredientId).price, 0);
  return { base, crustExtra, toppingsTotal, perPizza: base + crustExtra + toppingsTotal };
}

function calculateOrderTotal(quantity) {
  const subtotal = calculatePizzaPrice().perPizza * quantity;
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  return { subtotal, delivery, total: subtotal + delivery };
}

const priceFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatPrice = (n) => {
  const v = Math.round(n * 100) / 100;
  return Number.isInteger(v) ? `$${v}` : priceFormatter.format(v);
};
const randomBetween = (min, max) => min + Math.random() * (max - min);

/* =========================================================
   7. ORDER & FORM
   ========================================================= */
function changeQuantity(delta) {
  ui.quantity = Math.min(MAX_QUANTITY, Math.max(1, ui.quantity + delta));
  renderBreakdown();
}

// Returns an error message, or "" if the field is fine.
function validateField(name) {
  const form = dom.orderForm;
  const value = (form.elements[name]?.value || "").trim();
  switch (name) {
    case "name":
      return value.length < 2 ? "Please enter your name." : "";
    case "phone": {
      const digits = value.replace(/\D/g, "");
      if (!value) return "Please enter a phone number.";
      return /^[+\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15 ? "" : "That doesn't look like a phone number.";
    }
    case "address":
      return value.length < 6 ? "Please enter your full delivery address." : "";
    case "time":
      if (form.elements.when.value !== "scheduled") return "";
      return value ? "" : "Please pick a delivery time.";
    default:
      return "";
  }
}

const FIELD_IDS = { name: "fName", phone: "fPhone", address: "fAddress", time: "fTime" };

function showFieldError(name) {
  const message = validateField(name);
  const input = $(FIELD_IDS[name]);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  $(`${FIELD_IDS[name]}Error`).textContent = message;
  return !message;
}

function onSubmitOrder(event) {
  event.preventDefault();
  const names = Object.keys(FIELD_IDS);
  const results = names.map(showFieldError);
  const firstBad = names.find((n, i) => !results[i]);
  if (firstBad) { $(FIELD_IDS[firstBad]).focus(); return; }
  dom.confirmTotal.textContent = formatPrice(calculateOrderTotal(ui.quantity).total);
  dom.confirmDialog.showModal();
}

function placeOrder() {
  if (ui.isPlacingOrder) return;
  ui.isPlacingOrder = true;
  dom.placeOrderBtn.disabled = true;
  dom.cancelOrderBtn.disabled = true;
  dom.placeOrderBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Sending…`;
  setTimeout(showSuccess, 1200); // fake network delay — no real backend
}

function showSuccess() {
  const form = dom.orderForm;
  const order = calculateOrderTotal(ui.quantity);
  const scheduled = form.elements.when.value === "scheduled";
  const eta = scheduled ? form.elements.time.value : new Date(Date.now() + 35 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  dom.successNumber.textContent = `#NB-${Math.floor(1000 + Math.random() * 9000)}`;
  dom.successEta.textContent = scheduled ? eta : `about 35 min (${eta})`;
  const rows = [
    [`${ui.quantity} × ${SIZES[state.size].label} pizza`, formatPrice(order.subtotal)],
    ["Delivery", order.delivery === 0 ? "Free" : formatPrice(order.delivery)],
    ["Total", formatPrice(order.total)],
    ["Payment", form.elements.payment.value === "cash" ? "Cash on delivery" : "Card on delivery"],
  ];
  dom.successSummary.replaceChildren(...rows.map(([label, value]) => {
    const li = document.createElement("li");
    const a = document.createElement("span"); a.textContent = label;
    const b = document.createElement("strong"); b.textContent = value;
    li.append(a, b);
    return li;
  }));

  dom.confirmDialog.close();
  dom.placeOrderBtn.textContent = "Confirm";
  dom.placeOrderBtn.disabled = false;
  dom.cancelOrderBtn.disabled = false;
  ui.isPlacingOrder = false;
  stopChallenge();

  dom.orderView.hidden = true;
  dom.successView.hidden = false;
  dom.successView.focus();
  window.scrollTo({ top: dom.orderSection.offsetTop - 70, behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
  launchConfetti();
  announce("Order placed.");
}

function buildAnother() {
  history.length = 0;
  ui.quantity = 1;
  ui.unlocked.clear();
  ui.selectedToppingId = null;
  state = createDefaultState();
  saveState();
  dom.orderForm.reset();
  dom.timeInput.disabled = true;
  dom.orderForm.querySelectorAll("[aria-invalid]").forEach((el) => el.setAttribute("aria-invalid", "false"));
  dom.orderForm.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; });
  dom.successView.hidden = true;
  dom.orderView.hidden = false;
  render();
  window.scrollTo({ top: $("builder").offsetTop - 70, behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
}

/* ---------- Icons (Lucide) ---------- */
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.75 } });
}
function setButton(btn, icon, label) {
  btn.innerHTML = `<i data-lucide="${icon}"></i>`;
  if (label) btn.append(label);
  refreshIcons();
}

/* ---------- Parallax decorations ---------- */
// Builds a small decorative pizza for the floating layers.
function createMiniPizza() {
  const img = document.createElement("img");
  img.src = "assets/pizza-hero.png";
  img.alt = "";
  img.className = "float-pizza";
  img.draggable = false;
  return img;
}

// Each [data-float] moves at its own speed relative to its section → depth.
function initParallax() {
  const floats = [...document.querySelectorAll("[data-float]")];
  floats.forEach((el, i) => {
    const kind = el.dataset.float;
    el.appendChild(kind === "pizza" ? createMiniPizza() : createPieceVisual(INGREDIENT_BY_ID.get(kind)));
  });
  const movers = [...floats, ...document.querySelectorAll("[data-float-static]")].map((el) => ({
    el, speed: Number(el.dataset.speed) || 0, host: el.closest("[data-parallax]"), spins: !!el.dataset.float,
  }));
  const spinner = document.querySelector("[data-spin]");
  if (prefersReducedMotion.matches) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    for (const m of movers) {
      const r = m.host.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const y = -(r.top + r.height / 2 - vh / 2) * m.speed;
      m.el.style.setProperty("--py", `${y.toFixed(1)}px`);
      if (m.spins) m.el.style.setProperty("--pr", `${(y * 0.25).toFixed(1)}deg`);
    }
    if (spinner) spinner.style.setProperty("--spin", `${(window.scrollY * 0.12).toFixed(1)}deg`);
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  update();
}

/* =========================================================
   8. INIT
   ========================================================= */
function buildTray() {
  const buttons = INGREDIENTS.map((ingredient) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ingredient";
    btn.dataset.ingredientId = ingredient.id;
    btn.setAttribute("aria-label", `Add ${ingredient.name}, ${formatPrice(ingredient.price)}`);
    const visual = document.createElement("span");
    visual.className = "ingredient-visual";
    visual.appendChild(createPieceVisual(ingredient));
    const name = document.createElement("span");
    name.className = "ingredient-name";
    name.textContent = ingredient.name;
    const price = document.createElement("span");
    price.className = "ingredient-price";
    price.textContent = `+${formatPrice(ingredient.price)}`;
    btn.append(visual, name, price);
    btn.addEventListener("pointerdown", (e) => onPointerDown(e, { kind: "tray", ingredientId: ingredient.id, originEl: btn }));
    // Keyboard: Enter/Space fire "click" with detail 0. Pointer taps are handled in onPointerUp.
    btn.addEventListener("click", (e) => { if (e.detail === 0) addToppingAtRandomSpot(ingredient.id); });
    return btn;
  });
  dom.tray.replaceChildren(...buttons);
}

function bindEvents() {
  // Size / crust / sauce
  document.querySelectorAll('input[name="size"], input[name="crust"], input[name="sauce"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (state[input.name] === input.value) return;
      updateState((s) => { s[input.name] = input.value; });
      announceChange(`${input.name[0].toUpperCase() + input.name.slice(1)} changed.`);
    });
  });

  // Placed toppings (event delegation: one listener for all of them)
  dom.toppingsLayer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".placed");
    if (!el || e.target.closest(".piece-remove")) return;
    onPointerDown(e, { kind: "placed", toppingId: Number(el.dataset.toppingId), el });
  });
  dom.toppingsLayer.addEventListener("click", (e) => {
    const btn = e.target.closest(".piece-remove");
    if (btn) removeTopping(Number(btn.parentElement.dataset.toppingId));
  });
  document.addEventListener("pointerdown", (e) => {
    if (ui.selectedToppingId !== null && !e.target.closest(".placed")) {
      ui.selectedToppingId = null;
      renderToppings();
    }
  });

  dom.undoBtn.addEventListener("click", undo);
  dom.clearBtn.addEventListener("click", clearPizza);
  dom.surpriseBtn.addEventListener("click", surpriseMe);
  dom.soundBtn.addEventListener("click", toggleSound);
  dom.challengeBtn.addEventListener("click", startChallenge);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ui.drag) cancelDrag();
    const tag = e.target.tagName;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      undo();
    }
  });

  // Order
  dom.qtyMinus.addEventListener("click", () => changeQuantity(-1));
  dom.qtyPlus.addEventListener("click", () => changeQuantity(1));
  dom.orderForm.addEventListener("submit", onSubmitOrder);
  for (const name of Object.keys(FIELD_IDS)) {
    const input = $(FIELD_IDS[name]);
    input.addEventListener("blur", () => { if (input.value || input.getAttribute("aria-invalid") === "true") showFieldError(name); });
    input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") showFieldError(name); });
  }
  dom.orderForm.querySelectorAll('input[name="when"]').forEach((r) => r.addEventListener("change", () => {
    const scheduled = r.value === "scheduled" && r.checked;
    dom.timeInput.disabled = !scheduled;
    if (scheduled) dom.timeInput.focus(); else showFieldError("time");
  }));
  dom.cancelOrderBtn.addEventListener("click", () => dom.confirmDialog.close());
  dom.placeOrderBtn.addEventListener("click", placeOrder);
  dom.confirmDialog.addEventListener("cancel", (e) => { if (ui.isPlacingOrder) e.preventDefault(); });
  dom.buildAnotherBtn.addEventListener("click", buildAnother);

  // Hide the mobile bar while the order section is on screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => dom.mobileBar.classList.toggle("is-hidden", entry.isIntersecting), { threshold: 0.05 })
      .observe(dom.orderSection);
  }
}

// Don't replay badges for a pizza restored from storage.
(function preloadBadges() {
  const byId = {};
  const byType = { meat: 0, veg: 0, cheese: 0, fruit: 0 };
  for (const t of state.toppings) {
    byId[t.ingredientId] = (byId[t.ingredientId] || 0) + 1;
    byType[INGREDIENT_BY_ID.get(t.ingredientId).type]++;
  }
  ACHIEVEMENTS.forEach((a) => { if (a.test({ byId, byType })) ui.unlocked.add(a.id); });
})();

buildTray();
initParallax();
bindEvents();
render();
refreshIcons();
