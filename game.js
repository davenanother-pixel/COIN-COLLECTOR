const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const levelCoinsEl = document.getElementById("levelCoins");
const savedCoinsEl = document.getElementById("savedCoins");
const bestTimeEl = document.getElementById("bestTime");
const overlay = document.getElementById("messageOverlay");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const messageButton = document.getElementById("messageButton");

const TILE_SIZE = 8;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;

const LEVEL_LAYOUT = [
  "####################",
  "#........#.....C...#",
  "#..C.....#..####...#",
  "#........#..#..#...#",
  "#..####..#..#..#...#",
  "#..#..#..#..#..#...#",
  "#..#..#..#..#..#...#",
  "#..#..#..#..#..#...#",
  "#..#..#..#..####...#",
  "#..#..#..#......C..#",
  "#..#..#..#####.....#",
  "#..#..#......#####.#",
  "#..#..#..C.......L.#",
  "#P.....#.....C.....#",
  "####################",
];

const COLORS = {
  floor: "#121933",
  wallTop: "#39406a",
  wallSide: "#1e243f",
  lava: "#ff4b4b",
  lavaGlow: "#ff9e6a",
  coin: "#ffd65a",
  coinHighlight: "#fff2b3",
  player: "#61dafb",
  playerShadow: "#2c4b6b",
  exit: "#55f28b",
};

const state = {
  player: { x: 0, y: 0, vx: 0, vy: 0 },
  coins: new Set(),
  levelCoins: 0,
  totalSaved: 0,
  bestTimeMs: null,
  startTime: null,
  running: true,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  reset: false,
};

function loadProgress() {
  const savedCoins = Number.parseInt(localStorage.getItem("coinCollectorTotal") || "0", 10);
  const bestTime = Number.parseInt(localStorage.getItem("coinCollectorBest") || "0", 10);
  state.totalSaved = Number.isNaN(savedCoins) ? 0 : savedCoins;
  state.bestTimeMs = bestTime > 0 ? bestTime : null;
  updateHud();
}

function saveProgress() {
  localStorage.setItem("coinCollectorTotal", String(state.totalSaved));
  if (state.bestTimeMs !== null) {
    localStorage.setItem("coinCollectorBest", String(state.bestTimeMs));
  }
}

function updateHud() {
  levelCoinsEl.textContent = String(state.levelCoins);
  savedCoinsEl.textContent = String(state.totalSaved);
  bestTimeEl.textContent = state.bestTimeMs ? formatTime(state.bestTimeMs) : "--";
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function buildLevel() {
  state.coins.clear();
  state.levelCoins = 0;
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const tile = LEVEL_LAYOUT[y][x];
      if (tile === "C") {
        state.coins.add(`${x},${y}`);
        state.levelCoins += 1;
      }
      if (tile === "P") {
        state.player.x = x * TILE_SIZE + TILE_SIZE / 2;
        state.player.y = y * TILE_SIZE + TILE_SIZE / 2;
      }
    }
  }
  state.startTime = performance.now();
  updateHud();
}

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
    return "#";
  }
  return LEVEL_LAYOUT[y][x];
}

function setOverlay(title, body, buttonLabel = "Continue") {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messageButton.textContent = buttonLabel;
  overlay.hidden = false;
  state.running = false;
}

function clearOverlay() {
  overlay.hidden = true;
  state.running = true;
  state.startTime = performance.now();
}

function resetLevel() {
  buildLevel();
  clearOverlay();
}

function applyInput() {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  const magnitude = Math.hypot(dx, dy) || 1;
  const speed = 42;
  state.player.vx = (dx / magnitude) * speed;
  state.player.vy = (dy / magnitude) * speed;
}

function detectCoin() {
  const tileX = Math.floor(state.player.x / TILE_SIZE);
  const tileY = Math.floor(state.player.y / TILE_SIZE);
  const key = `${tileX},${tileY}`;
  if (state.coins.has(key)) {
    state.coins.delete(key);
    state.levelCoins -= 1;
    state.totalSaved += 1;
    updateHud();
    saveProgress();
    if (state.levelCoins === 0) {
      const elapsed = performance.now() - state.startTime;
      if (state.bestTimeMs === null || elapsed < state.bestTimeMs) {
        state.bestTimeMs = elapsed;
      }
      saveProgress();
      setOverlay(
        "Level Clear!",
        `You collected every coin in ${formatTime(elapsed)}. Ready for another run?`,
        "Play Again"
      );
    }
  }
}

function handleHazards() {
  const tileX = Math.floor(state.player.x / TILE_SIZE);
  const tileY = Math.floor(state.player.y / TILE_SIZE);
  if (tileAt(tileX, tileY) === "L") {
    setOverlay("Ouch!", "Lava resets your run. Try again.", "Retry");
  }
}

function movePlayer(dt) {
  const half = TILE_SIZE * 0.35;
  const nextX = state.player.x + state.player.vx * dt;
  const nextY = state.player.y + state.player.vy * dt;

  const tryMove = (nx, ny) => {
    const left = Math.floor((nx - half) / TILE_SIZE);
    const right = Math.floor((nx + half) / TILE_SIZE);
    const top = Math.floor((ny - half) / TILE_SIZE);
    const bottom = Math.floor((ny + half) / TILE_SIZE);
    const blocked =
      tileAt(left, top) === "#" ||
      tileAt(right, top) === "#" ||
      tileAt(left, bottom) === "#" ||
      tileAt(right, bottom) === "#";
    return !blocked;
  };

  if (tryMove(nextX, state.player.y)) {
    state.player.x = nextX;
  }
  if (tryMove(state.player.x, nextY)) {
    state.player.y = nextY;
  }
}

function drawTile(x, y, tile) {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  if (tile === "#") {
    ctx.fillStyle = COLORS.wallSide;
    ctx.fillRect(px, py + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE / 2);
    ctx.strokeStyle = "#11162e";
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    return;
  }
  if (tile === "L") {
    ctx.fillStyle = COLORS.lava;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = COLORS.lavaGlow;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE / 3);
    return;
  }
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
}

function drawCoin(x, y) {
  const px = x * TILE_SIZE + TILE_SIZE / 2;
  const py = y * TILE_SIZE + TILE_SIZE / 2;
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(px, py, TILE_SIZE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.coinHighlight;
  ctx.beginPath();
  ctx.arc(px - 1, py - 1, TILE_SIZE * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const px = state.player.x;
  const py = state.player.y;
  ctx.fillStyle = COLORS.playerShadow;
  ctx.fillRect(px - 3, py + 1, 6, 4);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(px - 3, py - 4, 6, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px - 2, py - 3, 2, 2);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      drawTile(x, y, LEVEL_LAYOUT[y][x]);
    }
  }

  state.coins.forEach((entry) => {
    const [x, y] = entry.split(",").map(Number);
    drawCoin(x, y);
  });

  drawPlayer();
}

let lastTime = performance.now();
function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  pollGamepad();
  applyInput();
  if (state.running) {
    movePlayer(dt);
    detectCoin();
    handleHazards();
  }
  render();
  if (input.reset) {
    input.reset = false;
    resetLevel();
  }
  requestAnimationFrame(tick);
}

function handleKey(event, isDown) {
  switch (event.key.toLowerCase()) {
    case "arrowup":
    case "w":
      input.up = isDown;
      break;
    case "arrowdown":
    case "s":
      input.down = isDown;
      break;
    case "arrowleft":
    case "a":
      input.left = isDown;
      break;
    case "arrowright":
    case "d":
      input.right = isDown;
      break;
    case "r":
      if (isDown) input.reset = true;
      break;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));

function pollGamepad() {
  const [pad] = navigator.getGamepads ? navigator.getGamepads() : [];
  if (!pad) return;

  const deadZone = 0.2;
  const axisX = Math.abs(pad.axes[0]) > deadZone ? pad.axes[0] : 0;
  const axisY = Math.abs(pad.axes[1]) > deadZone ? pad.axes[1] : 0;

  const dpadUp = pad.buttons[12]?.pressed;
  const dpadDown = pad.buttons[13]?.pressed;
  const dpadLeft = pad.buttons[14]?.pressed;
  const dpadRight = pad.buttons[15]?.pressed;

  input.left = axisX < -deadZone || dpadLeft;
  input.right = axisX > deadZone || dpadRight;
  input.up = axisY < -deadZone || dpadUp;
  input.down = axisY > deadZone || dpadDown;

  if (pad.buttons[0]?.pressed) {
    input.reset = true;
  }
}

function setupTouchControls() {
  const touchButtons = document.querySelectorAll(".touch-button");
  touchButtons.forEach((button) => {
    button.addEventListener("pointerdown", () => {
      const dir = button.dataset.dir;
      if (dir) {
        input[dir] = true;
      }
      if (button.dataset.action === "reset") {
        input.reset = true;
      }
    });
    button.addEventListener("pointerup", () => {
      const dir = button.dataset.dir;
      if (dir) {
        input[dir] = false;
      }
    });
    button.addEventListener("pointerleave", () => {
      const dir = button.dataset.dir;
      if (dir) {
        input[dir] = false;
      }
    });
  });
}

messageButton.addEventListener("click", () => {
  resetLevel();
});

loadProgress();
buildLevel();
setupTouchControls();
requestAnimationFrame(tick);
