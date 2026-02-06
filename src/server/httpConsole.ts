// src/server/httpConsole.ts
//
// FULL FILE REPLACEMENT.
//
// Goals / fixes included:
// 1) Dice lifecycle UX: after a successful move, if pending dice remain, auto-fetch legal moves for the remaining selected die
//    (and always clear stale moves immediately after a move).
// 2) Start button is always visible (it is no longer hidden when auto-ready is enabled).
// 3) Ready controls are always visible; when auto-ready is ON they are disabled (greyed out), when auto-ready is OFF they are enabled.
// 4) bankedExtraDice: console now reads canonical `bankedExtraDice` and enforces the cashout roll size (N banked => roll exactly N dice).
// 5) Server-authoritative dice: pending dice are taken from server messages (legalMoves / moveResult.nextState) and local optimistic state is unwound on errors.
//
// Notes:
// - This is a debug console. It intentionally mirrors protocol behavior and does not enforce gameplay "smarts" beyond keeping UI state consistent.

import http, { type IncomingMessage, type ServerResponse } from "node:http";

type StartHttpConsoleOptions = {
  port?: number;
  httpPort?: number; // legacy
  host?: string;
  defaultWsUrl?: string;
};

export function startHttpConsole(...args: any[]) {
  const first = args[0] as unknown;
  const second = args[1] as unknown;

  let port = 8788;
  let host: string | undefined = undefined;

  if (typeof first === "number") {
    port = first;
    if (typeof second === "string") host = second;
  } else if (first && typeof first === "object") {
    const o = first as StartHttpConsoleOptions;
    if (typeof o.httpPort === "number") port = o.httpPort;
    else if (typeof o.port === "number") port = o.port;
    if (typeof o.host === "string") host = o.host;
  }

  const server = http.createServer((req, res) => serveHttpConsole(req, res));
  server.listen(port, host);

  // Keep parity with devServer expectations: return an object with .port (effective) where possible.
  const addr = server.address();
  const effectivePort =
    addr && typeof addr === "object" && typeof addr.port === "number" ? addr.port : port;

  return Object.assign(server, { port: effectivePort });
}

export function serveHttpConsole(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || "/";
  if (url === "/" || url.startsWith("/?")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html());
    return;
  }

  if (url === "/board" || url.startsWith("/board?")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(htmlBoard());
    return;
  }


  if (url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  // Optional: quiet the favicon 404 noise
  if (url === "/favicon.ico") {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 404;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end("not found");
}

function html(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LMR - Game Console</title>
  <style>
    :root{
      --bg:#ffffff;
      --card:#f7f7f8;
      --card2:#ffffff;
      --border:#d7d7dc;
      --muted:#5a5a63;
      --text:#111111;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      --accent:#0b57d0;
      --err:#b91c1c;
      --ok:#166534;
    }
    html, body { height:100%; }
    body{
      margin:0;
      padding:18px;
      background:var(--bg);
      color:var(--text);
      font-family:var(--sans);
    }
    .grid{
      display:grid;
      grid-template-columns: 460px 1fr;
      gap:14px;
      align-items:start;
    }
    .card{
      background:var(--card);
      border:1px solid var(--border);
      border-radius:10px;
      padding:12px;
    }
    .card.white{ background:var(--card2); }
    .row{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .row > * { margin:3px 0; }
    label{ font-size:12px; color:var(--muted); }
    input, select, button, textarea{
      font-family:var(--sans);
      font-size:14px;
      border:1px solid var(--border);
      border-radius:8px;
      padding:8px 10px;
      background:#fff;
      color:var(--text);
      outline:none;
    }
    textarea{ width:100%; min-height:140px; font-family:var(--mono); font-size:12px; }
    button{
      cursor:pointer;
      border:1px solid var(--border);
      background:#fff;
    }
    button.primary{
      border-color:var(--accent);
      color:var(--accent);
      font-weight:600;
    }
    button:disabled{ opacity:0.5; cursor:not-allowed; }
    .mono{ font-family:var(--mono); }
    .small{ font-size:12px; color:var(--muted); }
    .kv{
      display:grid;
      grid-template-columns: 160px 1fr;
      gap:6px 10px;
      margin-top:8px;
    }
    .divider{ height:1px; background:var(--border); margin:10px 0; }
    table{
      width:100%;
      border-collapse:collapse;
      font-family:var(--mono);
      font-size:12px;
      background:#fff;
      border:1px solid var(--border);
      border-radius:10px;
      overflow:hidden;
    }
    th, td{
      padding:8px 10px;
      border-bottom:1px solid var(--border);
      text-align:left;
      vertical-align:top;
    }
    tr:last-child td{ border-bottom:none; }
    tr.clickable:hover{ background:#f2f6ff; }
    .pill{
      display:inline-block;
      font-size:12px;
      padding:2px 8px;
      border:1px solid var(--border);
      border-radius:999px;
      background:#fff;
      color:var(--muted);
    }
    .pill.ok{ color:var(--ok); border-color:#bfe7c7; background:#f2fbf4; }
    .pill.err{ color:var(--err); border-color:#f3b5b5; background:#fff1f1; }
    .diceList{
      width:100%;
      border:1px solid var(--border);
      border-radius:10px;
      background:#fff;
      overflow:hidden;
      font-family:var(--mono);
      font-size:12px;
    }
    .diceRow{
      display:grid;
      grid-template-columns: 28px 1fr 90px 110px;
      gap:8px;
      align-items:center;
      padding:8px 10px;
      border-bottom:1px solid var(--border);
    }
    .diceRow:last-child{ border-bottom:none; }
    .diceValue{ font-weight:700; }
    .right{ text-align:right; }
    .checkRow{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
      padding:6px 0;
    }
    .checkRow label{
      display:flex;
      align-items:center;
      gap:6px;
      font-size:13px;
      color:var(--text);
    }
    input[type="checkbox"]{ width:16px; height:16px; }
    .linkish{
      font-size:12px;
      color:var(--accent);
      text-decoration:underline;
      cursor:pointer;
      user-select:none;
    }
    .linkish.disabled{
      color:var(--muted);
      text-decoration:none;
      cursor:not-allowed;
    }
  </style>
</head>
<body>
  <div class="row" style="justify-content:space-between;">
    <div>
      <h2 style="margin:0 0 6px 0;">LMR - Game Console</h2>
      <div class="small">Double Dice verification (one-die resolve + stable pending dice UI)</div>
    </div>
    <div class="small mono">http://localhost:8788</div>
  </div>

  <div class="grid" style="margin-top:12px;">
    <div class="card">

      <!-- TOP-LEFT: Roll / Resolve / Apply -->
      <h3 style="margin:0 0 10px 0;">Roll Dice (individual lines)</h3>
      <div class="small">Set each die value, then Submit Roll.</div>
      <div style="margin-top:8px;">
        <div class="diceList" id="rollDiceList"></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button id="btnSubmitRoll" disabled class="primary">Submit Roll</button>
        <button id="btnClearRoll" disabled>Clear Roll</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Resolve Dice</h3>
      <div class="small">Select a pending die. Moves auto-refresh (optional).</div>

      <div class="row" style="margin-top:6px;">
        <span id="autoFetchLink" class="linkish disabled">auto-fetch moves on selection</span>
        <span class="small mono" id="autoFetchState">(off)</span>
      </div>

      <div style="margin-top:8px;">
        <div class="diceList" id="pendingDiceList"></div>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Apply Move</h3>
      <div class="row">
        <div style="flex:1;">
          <label>Move Index</label><br/>
          <input id="moveIndex" style="width:100%;" placeholder="click a move on the right" />
        </div>
      </div>
      <div class="row" style="margin-top:8px;">
        <button id="btnMove" disabled class="primary">Send Move (spends selected die)</button>
        <button id="btnClearMoves" disabled>Clear Moves</button>
      </div>

      <div class="divider"></div>

      <!-- BELOW: Connection / Start / Turn Panel -->
      <h3 style="margin:0 0 10px 0;">Connection</h3>

      <div class="row">
        <div style="flex:1;">
          <label>WS URL</label><br/>
          <input id="wsUrl" style="width:100%;" value="ws://localhost:8787" />
        </div>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>Client ID (used only on Hello)</label><br/>
          <input id="clientId" style="width:100%;" />
        </div>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>Room Code</label><br/>
          <input id="roomCode" style="width:100%;" placeholder="(auto on join if blank)" />
        </div>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>Claim Player ID (optional)</label><br/>
          <input id="claimPlayerId" style="width:100%;" placeholder="p0 / p1 / ..." />
        </div>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>Actor ID (your seat)</label><br/>
          <input id="actorId" style="width:100%;" placeholder="p0 / p1 / ..." />
        </div>
      </div>

      <div class="row">
        <button class="primary" id="btnConnect">Connect</button>
        <button id="btnDisconnect" disabled>Disconnect</button>
      </div>

      <div class="row">
        <button id="btnHello" disabled>Hello</button>
        <button id="btnJoin" disabled>Join Room</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Start Options</h3>
      <div class="row">
        <div style="flex:1;">
          <label>playerCount</label><br/>
          <input id="playerCount" style="width:100%;" value="2" />
        </div>
        <div style="flex:1;">
          <label>boardOverride (optional)</label><br/>
          <select id="boardOverride" style="width:100%;">
            <option value="">(none)</option>
            <option value="4">4</option>
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </div>
      </div>

      <div class="checkRow">
        <label><input id="optDoubleDice" type="checkbox" checked /> doubleDice</label>
        <label><input id="optKillRoll" type="checkbox" /> killRoll</label>
        <label><input id="optTeamPlay" type="checkbox" /> teamPlay</label>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>teamCount (only if teamPlay)</label><br/>
          <input id="teamCount" style="width:100%;" value="2" />
        </div>
      </div>

      <div class="checkRow">
        <label title="When ON, the console automatically calls setReady(true) after joining a room.">
          <input id="optAutoReady" type="checkbox" /> auto-ready (debug)
        </label>
      </div>

      <!-- Ready controls always visible; disabled when auto-ready is ON -->
      <div class="row" style="margin-top:6px;">
        <button id="btnReadyTrue" disabled>Ready: true</button>
        <button id="btnReadyFalse" disabled>Ready: false</button>
      </div>

      <!-- Start is always visible -->
      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Lobby Config (pre-start)</h3>

      <div class="row">
        <button id="btnApplyLobbyConfig" disabled class="primary">Apply Lobby Config</button>
        <span class="pill" id="lobbyPhasePill">phase</span>
        <span class="small mono" id="lobbySummary">(not joined)</span>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>lobby.gameConfig (server)</label><br/>
          <textarea id="lobbyGameConfig" spellcheck="false" readonly style="min-height:110px;"></textarea>
        </div>
      </div>

      <div class="row">
        <div style="flex:1;">
          <label>Last lobby error (if any)</label><br/>
          <div id="lobbyError" class="small mono" style="white-space:pre-wrap; color:var(--err);">(none)</div>
        </div>
      </div>

      <div class="row" style="margin-top:6px;">
        <button id="btnStart" disabled class="primary">Start</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Turn / Dice Panel</h3>

      <div class="kv mono">
        <div>nextActorId</div><div id="nextActorId">(unknown)</div>
        <div>awaitingDice</div><div id="awaitingDice">(unknown)</div>
        <div>doubleDice (server)</div><div id="doubleDice">(unknown)</div>
        <div>doubleDice (effective)</div><div id="doubleDiceEff">(unknown)</div>
        <div>pendingDice (UI)</div><div id="pendingDiceUI">(none)</div>
        <div>bankedExtraDice</div><div id="bankedExtraDice">(unknown)</div>
        <div>eligibleToRoll</div><div id="eligibleToRoll">(unknown)</div>
        <div>eligibleToResolve</div><div id="eligibleToResolve">(unknown)</div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <span class="pill" id="lastActionPill">lastAction</span>
        <span class="small mono" id="lastActionText">(none)</span>
      </div>
    </div>

    <div class="card white">
      <h3 style="margin:0 0 10px 0;">Moves</h3>
      <table>
        <thead><tr><th style="width:60px;">idx</th><th>move</th></tr></thead>
        <tbody id="movesBody"></tbody>
      </table>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Log</h3>
      <textarea id="log" spellcheck="false"></textarea>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Last moveResult</h3>
      <textarea id="lastMoveResult" spellcheck="false"></textarea>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Raw (last message)</h3>
      <textarea id="rawState" spellcheck="false"></textarea>
    </div>
  </div>

<script>
(function(){
  document.documentElement.style.colorScheme = "light";
  document.body.style.background = "#ffffff";
  document.body.style.color = "#111111";

  const logEl = document.getElementById("log");
  const rawEl = document.getElementById("rawState");
  const lastMoveResultEl = document.getElementById("lastMoveResult");

  const wsUrlEl = document.getElementById("wsUrl");
  const clientIdEl = document.getElementById("clientId");
  const roomCodeEl = document.getElementById("roomCode");
  const claimPlayerIdEl = document.getElementById("claimPlayerId");
  const actorIdEl = document.getElementById("actorId");

  const playerCountEl = document.getElementById("playerCount");
  const boardOverrideEl = document.getElementById("boardOverride");
  const optDoubleDiceEl = document.getElementById("optDoubleDice");
  const optKillRollEl = document.getElementById("optKillRoll");
  const optTeamPlayEl = document.getElementById("optTeamPlay");
  const teamCountEl = document.getElementById("teamCount");
  const optAutoReadyEl = document.getElementById("optAutoReady");

  const btnConnectEl = document.getElementById("btnConnect");
  const btnDisconnectEl = document.getElementById("btnDisconnect");
  const btnHelloEl = document.getElementById("btnHello");
  const btnJoinEl = document.getElementById("btnJoin");
  const btnReadyTrueEl = document.getElementById("btnReadyTrue");
  const btnReadyFalseEl = document.getElementById("btnReadyFalse");
  const btnStartEl = document.getElementById("btnStart");
const btnApplyLobbyConfigEl = document.getElementById("btnApplyLobbyConfig");

  const btnSubmitRollEl = document.getElementById("btnSubmitRoll");
  const btnClearRollEl = document.getElementById("btnClearRoll");

  const btnMoveEl = document.getElementById("btnMove");
  const btnClearMovesEl = document.getElementById("btnClearMoves");

  const autoFetchLinkEl = document.getElementById("autoFetchLink");
  const autoFetchStateEl = document.getElementById("autoFetchState");

  const lastActionTextEl = document.getElementById("lastActionText");
  const lastActionPillEl = document.getElementById("lastActionPill");
  const lobbyPhasePillEl = document.getElementById("lobbyPhasePill");
  const lobbySummaryEl = document.getElementById("lobbySummary");
  const lobbyGameConfigEl = document.getElementById("lobbyGameConfig");
  const lobbyErrorEl = document.getElementById("lobbyError");
  const movesBodyEl = document.getElementById("movesBody");

  const nextActorIdEl = document.getElementById("nextActorId");
  const awaitingDiceEl = document.getElementById("awaitingDice");
  const doubleDiceEl = document.getElementById("doubleDice");
  const doubleDiceEffEl = document.getElementById("doubleDiceEff");
  const pendingDiceUIEl = document.getElementById("pendingDiceUI");
  const bankedExtraEl = document.getElementById("bankedExtraDice");
  const eligibleToRollEl = document.getElementById("eligibleToRoll");
  const eligibleToResolveEl = document.getElementById("eligibleToResolve");

  const rollDiceListEl = document.getElementById("rollDiceList");
  const pendingDiceListEl = document.getElementById("pendingDiceList");
  const moveIndexEl = document.getElementById("moveIndex");

  function rndId(prefix){
    const s = Math.random().toString(16).slice(2, 10);
    return prefix + s;
  }

  if (!clientIdEl.value || !clientIdEl.value.trim()){
    clientIdEl.value = rndId("ui-");
  }

  let ws = null;
  let connected = false;
  let joined = false;

  // Latest lobby snapshot from server (lobbySync)
  let lastLobby = null;
  let lastLobbyError = "";

  // Moves shown in the right column (for last requested die)
  let lastMoves = [];
  let lastAction = "";

  // Roll slots (always length = dicePerRoll())
  let rollSlots = [];

  // Pending dice as the USER sees them (stable list)
  // This is sourced from: last successful roll submission, then spent on each successful move.
  let pendingDiceUI = [];
  let selectedPendingIdx = 0;

  // Turn fields (from server messages)
  let turnNextActorId = null;
  let turnAwaitingDice = null;
  let optDoubleDiceServer = null;
  let bankedExtraDice = null;
  // If we had to infer bank count from a BAD_ROLL error, keep it until server explicitly provides bankedExtraDice.
  let bankedExtraDiceLocked = false;
  let bankedExtraDiceLockValue = null;

  // Auto-fetch moves when selecting a pending die
  let autoFetch = true;

  // Auto-ready: when ON, we send setReady(true) after joining a room.
  let autoReadySentForRoom = null;

  function addLine(s){ logEl.value += s + "\\n"; logEl.scrollTop = logEl.scrollHeight; }
  function addOk(s){ addLine("[OK] " + s); }
  function addWarn(s){ addLine("[WARN] " + s); }
  function addErr(s){ addLine("[ERR] " + s); }

  function setRaw(obj){ rawEl.value = JSON.stringify(obj, null, 2); }

  function pill(el, kind){
    el.classList.remove("ok","err");
    if (kind) el.classList.add(kind);
  }

  function deepGet(obj, path){
    try{
      let cur = obj;
      for (const k of path){
        if (!cur || typeof cur !== "object") return undefined;
        cur = cur[k];
      }
      return cur;
    }catch(_){ return undefined; }
  }

  function deepFindFirst(obj, predicate){
    const seen = new Set();
    function walk(x){
      if (!x || typeof x !== "object") return undefined;
      if (seen.has(x)) return undefined;
      seen.add(x);
      if (predicate(x)) return x;
      if (Array.isArray(x)){
        for (const v of x){
          const r = walk(v);
          if (r !== undefined) return r;
        }
      }else{
        for (const k of Object.keys(x)){
          const r = walk(x[k]);
          if (r !== undefined) return r;
        }
      }
      return undefined;
    }
    return walk(obj);
  }

  function effectiveDoubleDice(){
    if (typeof optDoubleDiceServer === "boolean") return optDoubleDiceServer;
    return !!optDoubleDiceEl.checked;
  }

  function dicePerRoll(){
    // v1.7.4 bank cashout: if N banked extra dice exist, the next roll must consist of exactly N dice.
    if (typeof bankedExtraDice === "number" && Number.isFinite(bankedExtraDice) && bankedExtraDice > 0) return bankedExtraDice;
    return effectiveDoubleDice() ? 2 : 1;
  }

  function resetRollSlots(){
    rollSlots = new Array(dicePerRoll()).fill(null);
  }

  function renderRollDiceList(){
    rollDiceListEl.innerHTML = "";

    const n = dicePerRoll();
    if (!Array.isArray(rollSlots) || rollSlots.length !== n) resetRollSlots();

    for (let i=0;i<n;i++){
      const row = document.createElement("div");
      row.className = "diceRow";
      row.style.gridTemplateColumns = "1fr 90px 110px";

      const label = document.createElement("div");
      label.textContent = "Die " + (i+1);
      row.appendChild(label);

      const val = document.createElement("div");
      val.className = "diceValue right";
      val.textContent = (rollSlots[i] == null) ? "—" : String(rollSlots[i]);
      row.appendChild(val);

      const inputWrap = document.createElement("div");
      const sel = document.createElement("select");
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "set…";
      sel.appendChild(opt0);
      for (let d=1; d<=6; d++){
        const o = document.createElement("option");
        o.value = String(d);
        o.textContent = String(d);
        if (rollSlots[i] === d) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => {
        rollSlots[i] = sel.value ? Number(sel.value) : null;
        renderRollDiceList();
        syncUI();
      };
      inputWrap.appendChild(sel);
      row.appendChild(inputWrap);

      rollDiceListEl.appendChild(row);
    }
  }

  function renderPendingDiceList(){
    pendingDiceListEl.innerHTML = "";

    if (!Array.isArray(pendingDiceUI) || pendingDiceUI.length === 0){
      const row = document.createElement("div");
      row.className = "diceRow";
      row.style.gridTemplateColumns = "1fr";
      const msg = document.createElement("div");
      msg.textContent = "(no pending dice)";
      row.appendChild(msg);
      pendingDiceListEl.appendChild(row);
      return;
    }

    if (selectedPendingIdx < 0 || selectedPendingIdx >= pendingDiceUI.length) selectedPendingIdx = 0;

    for (let i=0;i<pendingDiceUI.length;i++){
      const row = document.createElement("div");
      row.className = "diceRow";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "pendingDie";
      radio.checked = (i === selectedPendingIdx);
      radio.onchange = () => {
        selectedPendingIdx = i;
        // Always clear moves immediately on die change to avoid stale UI if request fails.
        lastMoves = [];
        renderMoves([]);
        moveIndexEl.value = "";
        syncUI();
        if (autoFetch) requestMovesForSelectedPendingDie();
      };
      row.appendChild(radio);

      const label = document.createElement("div");
      label.textContent = "Pending Die " + (i+1);
      row.appendChild(label);

      const val = document.createElement("div");
      val.className = "diceValue right";
      val.textContent = String(pendingDiceUI[i]);
      row.appendChild(val);

      const hint = document.createElement("div");
      hint.className = "small right";
      hint.textContent = (i === selectedPendingIdx) ? "selected" : "";
      row.appendChild(hint);

      pendingDiceListEl.appendChild(row);
    }
  }

  function renderMoves(moves){
    movesBodyEl.innerHTML = "";
    for (let i=0;i<moves.length;i++){
      const m = moves[i];
      const tr = document.createElement("tr");
      tr.className = "clickable";
      tr.onclick = () => { moveIndexEl.value = String(i); syncUI(); };

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(i);

      const tdMove = document.createElement("td");
      tdMove.textContent = (m && typeof m === "object" && m.id) ? String(m.id) : JSON.stringify(m);

      tr.appendChild(tdIdx);
      tr.appendChild(tdMove);
      movesBodyEl.appendChild(tr);
    }
  }

  function setAutoFetchUi(){
    const can = joined && Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0;
    autoFetchLinkEl.classList.toggle("disabled", !can);
    autoFetchStateEl.textContent = autoFetch ? "(on)" : "(off)";
    if (!can) autoFetchStateEl.textContent = "(off)";
  }

  function extractTurnFields(msg){
    // Prefer moveResult.response.result.turn when present (it is the authoritative "next").
    const tFromMoveResult =
      deepGet(msg, ["response","result","turn"]) ??
      deepGet(msg, ["response","result","result","turn"]); // defensive

    const t =
      tFromMoveResult ??
      msg.turn ??
      msg.game?.turn ??
      msg.state?.turn ??
      deepGet(msg, ["game","turn"]);

    if (t && typeof t === "object"){
      if (typeof t.nextActorId === "string") turnNextActorId = t.nextActorId;
      if (typeof t.awaitingDice === "boolean") turnAwaitingDice = t.awaitingDice;
    }

    const dd =
      msg?.lobby?.gameConfig?.options?.doubleDice ??
      deepGet(msg, ["state","config","options","doubleDice"]) ??
      deepGet(msg, ["response","result","nextState","config","options","doubleDice"]);

    if (typeof dd === "boolean") optDoubleDiceServer = dd;

    // Canonical: SessionState.bankedExtraDice (number).
    // Note: legalMoves attaches turn.bankedExtraDice ONLY when >0.
    // If msg.turn exists on a legalMoves message but lacks bankedExtraDice, interpret that as 0.
    let b =
      // Prefer explicit bank count provided on moveResult response.turn (and related turn objects).
      deepGet(msg, ["response","turn","bankedExtraDice"]) ??
      deepGet(msg, ["response","result","turn","bankedExtraDice"]) ??
      deepGet(msg, ["response","result","nextState","bankedExtraDice"]) ??
      msg?.bankedExtraDice ??
      msg?.state?.bankedExtraDice ??
      msg?.game?.bankedExtraDice ??
      msg?.turn?.bankedExtraDice ??
      undefined;

    if (typeof b === "number" && Number.isFinite(b)) {
      // If we inferred a required bank count from BAD_ROLL, do not allow it to "drift downward"
      // unless the server clearly indicates the bank has been consumed/reset.
      if (bankedExtraDiceLocked && typeof bankedExtraDiceLockValue === "number") {
        if (b === 0) {
          bankedExtraDice = 0;
          bankedExtraDiceLocked = false;
          bankedExtraDiceLockValue = null;
        } else if (b >= bankedExtraDiceLockValue) {
          bankedExtraDice = b;
          // keep lock until we see consumption, but update lock value to the latest explicit value
          bankedExtraDiceLockValue = b;
        } else {
          // Ignore contradictory smaller explicit values while locked.
        }
      } else {
        bankedExtraDice = b;
        bankedExtraDiceLocked = false;
        bankedExtraDiceLockValue = null;
      }
    }

// Hard invariant: if server says awaitingDice=true, there must be NO pending dice to resolve.
    if (turnAwaitingDice === true){
      pendingDiceUI = [];
      selectedPendingIdx = 0;
      lastMoves = [];
      renderMoves([]);
      moveIndexEl.value = "";
    }
  }

  function syncTurnPanel(){
    nextActorIdEl.textContent = (turnNextActorId ?? "(unknown)");
    awaitingDiceEl.textContent = (turnAwaitingDice === null ? "(unknown)" : String(turnAwaitingDice));
    doubleDiceEl.textContent = (typeof optDoubleDiceServer === "boolean") ? String(optDoubleDiceServer) : "(unknown)";
    doubleDiceEffEl.textContent = String(effectiveDoubleDice());

    pendingDiceUIEl.textContent = (Array.isArray(pendingDiceUI) && pendingDiceUI.length)
      ? JSON.stringify(pendingDiceUI)
      : "(none)";

    bankedExtraEl.textContent = (bankedExtraDice === null || bankedExtraDice === undefined) ? "(unknown)" : String(bankedExtraDice);

    const eligibleToRoll = (turnAwaitingDice === true) && (!pendingDiceUI || pendingDiceUI.length === 0);
    const eligibleToResolve = Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0;

    eligibleToRollEl.textContent = eligibleToRoll ? ("YES (roll " + dicePerRoll() + ")") : "NO";
    eligibleToResolveEl.textContent = eligibleToResolve ? "YES" : "NO";
  }


  function renderLobbyPanel(){
    const lobby = lastLobby;

    if (!lobbyPhasePillEl || !lobbySummaryEl || !lobbyGameConfigEl || !lobbyErrorEl) return;

    if (!lobby){
      lobbyPhasePillEl.textContent = "phase";
      pill(lobbyPhasePillEl, null);
      lobbySummaryEl.textContent = "(not joined)";
      lobbyGameConfigEl.value = "";
      lobbyErrorEl.textContent = lastLobbyError ? lastLobbyError : "(none)";
      return;
    }

    lobbyPhasePillEl.textContent = lobby.phase || "lobby";
    pill(lobbyPhasePillEl, (lobby.phase === "active") ? "err" : "ok");

    const players = Array.isArray(lobby.players) ? lobby.players : [];
    const pc = (lobby.gameConfig && typeof lobby.gameConfig.playerCount === "number") ? lobby.gameConfig.playerCount : lobby.expectedPlayerCount;

    const teamsLocked = !!(lobby.gameConfig && lobby.gameConfig.teams && lobby.gameConfig.teams.isLocked);
    const teamPlayOn = !!(lobby.gameConfig && lobby.gameConfig.teamPlay);

    const readyCount = players.filter(p => !!p.ready).length;

    lobbySummaryEl.textContent =
      "players=" + players.length +
      (Number.isFinite(pc) ? ("/" + pc) : "") +
      " ready=" + readyCount + "/" + players.length +
      " teamPlay=" + (teamPlayOn ? "on" : "off") +
      (teamPlayOn ? (" teamsLocked=" + (teamsLocked ? "yes" : "no")) : "");

    lobbyGameConfigEl.value = JSON.stringify(lobby.gameConfig ?? null, null, 2);
    lobbyErrorEl.textContent = lastLobbyError ? lastLobbyError : "(none)";
  }

  function syncUI(){
    btnDisconnectEl.disabled = !connected;
    btnConnectEl.disabled = connected;

    btnHelloEl.disabled = !connected;
    btnJoinEl.disabled = !connected;

    // Ready buttons are always visible. When auto-ready is ON, they are disabled.
    const autoReadyOn = !!optAutoReadyEl.checked;
    btnReadyTrueEl.disabled = !joined || autoReadyOn;
    btnReadyFalseEl.disabled = !joined || autoReadyOn;

    btnStartEl.disabled = !joined;

    const inLobby = joined && lastLobby && lastLobby.phase === "lobby";
    btnApplyLobbyConfigEl.disabled = !inLobby;


    const canRollNow = joined && (turnAwaitingDice === true) && (!pendingDiceUI || pendingDiceUI.length === 0);
    btnSubmitRollEl.disabled = !canRollNow || !rollSlots.every(v => Number.isFinite(v) && v>=1 && v<=6);
    btnClearRollEl.disabled = !canRollNow;

    const idx = Number(moveIndexEl.value);
    const canResolve = joined && Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0;
    btnMoveEl.disabled = !(canResolve && Number.isFinite(idx) && idx>=0 && idx<lastMoves.length);

    btnClearMovesEl.disabled = !joined;

    if (!lastAction || lastAction === "(none)"){
      pill(lastActionPillEl, null);
      lastActionPillEl.textContent = "lastAction";
    } else if (lastAction.startsWith("ERR") || lastAction.includes("error")){
      pill(lastActionPillEl, "err");
      lastActionPillEl.textContent = "lastAction";
    } else {
      pill(lastActionPillEl, "ok");
      lastActionPillEl.textContent = "lastAction";
    }

    lastActionTextEl.textContent = lastAction || "(none)";
    setAutoFetchUi();
    syncTurnPanel();
    renderLobbyPanel();
  }

  function sendRaw(obj){
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(obj));
  }

  function requestMovesForSelectedPendingDie(){
    const actorId = (actorIdEl.value || "").trim();
    if (!actorId) return;
    if (!Array.isArray(pendingDiceUI) || pendingDiceUI.length === 0) return;

    const idx = Math.max(0, Math.min(selectedPendingIdx, pendingDiceUI.length-1));
    const die = pendingDiceUI[idx];

    // Exactly one die per request (current contract).
    sendRaw({ type: "getLegalMoves", actorId, dice: [die] });
    lastAction = "getLegalMoves die=" + String(die);
    syncUI();
  }

  function maybeSendAutoReady(msg){
    if (!optAutoReadyEl.checked) return;
    const room = msg && msg.lobby && msg.lobby.roomCode ? String(msg.lobby.roomCode) : null;
    if (!room) return;
    if (autoReadySentForRoom === room) return;

    sendRaw({ type: "setReady", ready: true });
    autoReadySentForRoom = room;
    lastAction = "autoReady setReady true";
    addOk("auto-ready: setReady true");
  }

  function handleMsg(msg){
    setRaw(msg);

    if (!msg || typeof msg.type !== "string"){
      addWarn("Unknown msg: " + JSON.stringify(msg));
      return;
    }

    if (msg.type === "error"){
      const code = msg.code || "error";
      lastAction = "ERR " + code + " " + (msg.message || "");
      addErr("server error: " + JSON.stringify(msg));

      // If this error is plausibly related to lobby config actions, surface it in the lobby panel.
      try{
        const codeStr = String(code || "error");
        const msgStr = typeof msg.message === "string" ? msg.message : "";
        const looksLobby = (lastAction && lastAction.startsWith("setLobbyGameConfig"))
          || /lobby\s+gameConfig/i.test(msgStr)
          || /set\s+lobby\s+gameConfig/i.test(msgStr);
        if (looksLobby){
          lastLobbyError = codeStr + (msgStr ? (": " + msgStr) : "");
        }
      }catch(_){ }


      // Unwind local state on roll/turn-state errors to avoid UI desync loops.
      if (code === "BAD_ROLL" || code === "BAD_TURN_STATE" || code === "TURN_STATE" || code === "NOT_YOUR_TURN"){

        // FIX A: If server tells us the bank count / required roll size, adopt it immediately so the UI offers
        // the correct number of dice to roll next.
        if (code === "BAD_ROLL" && typeof msg.message === "string"){
          const m1 = msg.message.match(/must roll exactly\s+(\d+)\s+dice/i);
          const m2 = msg.message.match(/When\s+(\d+)\s+banked extra dice exist/i);
          const required = m1 ? Number(m1[1]) : null;
          const bank = m2 ? Number(m2[1]) : null;

          if (Number.isFinite(bank)) bankedExtraDice = bank;
          else if (Number.isFinite(required)) bankedExtraDice = required;

          if (typeof bankedExtraDice === "number" && Number.isFinite(bankedExtraDice)) {
            bankedExtraDiceLocked = true;
            bankedExtraDiceLockValue = bankedExtraDice;
          }

          // Also reset roll slots to the now-required count.
          resetRollSlots();
        }

        pendingDiceUI = [];
        selectedPendingIdx = 0;
        lastMoves = [];
        renderMoves([]);
        moveIndexEl.value = "";
        renderPendingDiceList();

        // Roll slot count (and roll eligibility text) may depend on bankedExtraDice.
        renderRollDiceList();
      }

      syncUI();
      return;
    }

    if (msg.type === "welcome"){
      addOk("welcome serverVersion=" + (msg.serverVersion || "?") + " clientId=" + (msg.clientId || "?"));
      lastAction = "welcome";
      syncUI();
      return;
    }

    if (msg.type === "roomJoined"){
      joined = true;
      if (msg.roomCode) roomCodeEl.value = msg.roomCode;

      // Protocol may provide actorId or playerId; use either.
      const pid = (typeof msg.actorId === "string" ? msg.actorId : (typeof msg.playerId === "string" ? msg.playerId : ""));
      if (pid) actorIdEl.value = pid;

      // Reset auto-ready latch when entering a new room join flow.
      autoReadySentForRoom = null;

      lastAction = "roomJoined";
      addOk("roomJoined room=" + msg.roomCode + " actorId=" + (pid || "undefined"));
      syncUI();
      return;
    }

    if (msg.type === "lobbySync"){
      lastAction = "lobbySync";
      lastLobby = msg.lobby || null;

      // Hydrate Start Options inputs from server lobby.gameConfig when present.
      try{
        const gc = lastLobby && lastLobby.gameConfig ? lastLobby.gameConfig : null;
        if (gc && typeof gc.playerCount === "number") playerCountEl.value = String(gc.playerCount);
        if (gc && typeof gc.teamPlay === "boolean") optTeamPlayEl.checked = !!gc.teamPlay;
        if (gc && typeof gc.teamCount === "number") teamCountEl.value = String(gc.teamCount);
        if (gc && typeof gc.doubleDice === "boolean") optDoubleDiceEl.checked = !!gc.doubleDice;
        if (gc && typeof gc.killRoll === "boolean") optKillRollEl.checked = !!gc.killRoll;
        if (gc && (gc.boardArmCount === 4 || gc.boardArmCount === 6 || gc.boardArmCount === 8)){
          boardOverrideEl.value = String(gc.boardArmCount);
        }
      }catch(_){}

      extractTurnFields(msg);
      renderRollDiceList();
      maybeSendAutoReady(msg);
      syncUI();
      return;
    }

    if (msg.type === "stateSync"){
      lastAction = "stateSync";
      extractTurnFields(msg);

      // If server says we are awaitingDice, clear resolve UI; otherwise preserve pendingDiceUI.
      if (turnAwaitingDice === true){
        pendingDiceUI = [];
        selectedPendingIdx = 0;
        lastMoves = [];
        renderMoves([]);
        moveIndexEl.value = "";
      }

      renderRollDiceList();
      renderPendingDiceList();
      syncUI();
      return;
    }

    if (msg.type === "legalMoves"){
      // legalMoves.dice is the dice list for *this query* (often 1 die when auto-fetching per-selection).
      // It is NOT always the full pending resolve set. Therefore:
      // - Never shrink a larger pendingDiceUI based on a 1-die legalMoves response.
      // - Only adopt msg.dice as the pending set when it is clearly a fresh roll/authoritative replacement.
      extractTurnFields(msg);

      if (Array.isArray(msg.dice)){
        const incoming = msg.dice.slice();

        const shouldAdopt =
          // If we currently have no pending dice, adopt whatever the server sent.
          !Array.isArray(pendingDiceUI) || pendingDiceUI.length === 0
          // If the server sent more dice than we have, this is likely the initial roll response.
          || incoming.length > pendingDiceUI.length
          // If lengths match (>1), allow server to normalize/replace.
          || (incoming.length === pendingDiceUI.length && incoming.length > 1);

        if (shouldAdopt){
          pendingDiceUI = incoming;
        }

        if (!Array.isArray(pendingDiceUI)) pendingDiceUI = [];
        if (pendingDiceUI.length === 0) selectedPendingIdx = 0;
        else selectedPendingIdx = Math.max(0, Math.min(selectedPendingIdx, pendingDiceUI.length - 1));
      }

      // If we inferred a required bank cashout size from BAD_ROLL, clear the bank lock
      // when we observe the post-cashout roll arrive (pending dice count equals the required count and we are now resolving).
      if (bankedExtraDiceLocked && typeof bankedExtraDiceLockValue === "number" && Array.isArray(msg.dice)){
        const incomingLen = msg.dice.length;
        const nowResolving = (turnAwaitingDice === false);
        if (nowResolving && incomingLen === bankedExtraDiceLockValue && incomingLen > 0){
          bankedExtraDice = 0;
          bankedExtraDiceLocked = false;
          bankedExtraDiceLockValue = null;
          resetRollSlots();
        }
      }

      lastMoves = msg.moves || [];
      renderMoves(lastMoves);
      renderPendingDiceList();

      const d = (Array.isArray(msg.dice) && msg.dice.length === 1) ? msg.dice[0] : undefined;
      lastAction = "legalMoves for die=" + (typeof d === "number" ? String(d) : "?") + " moves=" + lastMoves.length;
      syncUI();
      return;
    }

    if (msg.type === "moveResult"){
      lastMoveResultEl.value = JSON.stringify(msg, null, 2);

      const r = msg.response;
      const ok = !!(r && typeof r === "object" && r.ok === true);
      lastAction = "moveResult ok=" + String(ok);
      addOk("moveResult ok=" + String(ok));

      if (!ok){
        try{
          const reason = (r && typeof r === "object") ? (r.reason || r.error || r.message) : undefined;
          if (reason) addErr("moveResult reason: " + JSON.stringify(reason));
        }catch(_){}
        extractTurnFields(msg);
        syncUI();
        return;
      }

      // On success: server-authoritative pendingDice comes from response.result.nextState.pendingDice when present.
      // This avoids UI desync when auto-pass / delegation / other server-side behaviors adjust dice.
      const nextPending = deepGet(msg, ["response","result","nextState","pendingDice"]);
      if (Array.isArray(nextPending)){
        pendingDiceUI = nextPending.slice();
        if (pendingDiceUI.length === 0) selectedPendingIdx = 0;
        else selectedPendingIdx = Math.max(0, Math.min(selectedPendingIdx, pendingDiceUI.length - 1));
      } else {
        // Fallback (best-effort): spend EXACTLY ONE selected die locally.
        if (Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0){
          const idx = Math.max(0, Math.min(selectedPendingIdx, pendingDiceUI.length-1));
          pendingDiceUI.splice(idx, 1);
          if (selectedPendingIdx >= pendingDiceUI.length) selectedPendingIdx = Math.max(0, pendingDiceUI.length-1);
        }
      }

      // Always clear stale moves immediately after a successful move.
      lastMoves = [];
      renderMoves([]);
      moveIndexEl.value = "";

      // Update turn fields from moveResult (prefer response.result.turn)
      extractTurnFields(msg);
      renderRollDiceList();

      // If pending dice remain, auto-fetch moves for the remaining selected die (if autoFetch is on).
      if (Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0){
        renderPendingDiceList();
        syncUI();
        if (autoFetch) requestMovesForSelectedPendingDie();
        return;
      }

      // No pending dice remain.
      renderPendingDiceList();
      syncUI();
      return;
    }

    lastAction = msg.type;
    extractTurnFields(msg);
    syncUI();
  }

  autoFetchLinkEl.onclick = () => {
    const can = joined && Array.isArray(pendingDiceUI) && pendingDiceUI.length > 0;
    if (!can) return;
    autoFetch = !autoFetch;
    lastAction = "autoFetch=" + (autoFetch ? "on" : "off");
    syncUI();
    if (autoFetch) requestMovesForSelectedPendingDie();
  };

  optAutoReadyEl.onchange = () => {
    lastAction = "autoReady=" + (optAutoReadyEl.checked ? "on" : "off");
    syncUI();
  };

  btnConnectEl.onclick = () => {
    const wsUrl = (wsUrlEl.value || "").trim();
    if (!wsUrl) return;

    try{
      ws = new WebSocket(wsUrl);
    }catch(e){
      addErr("WebSocket ctor failed: " + String(e));
      return;
    }

    connected = false;
    joined = false;

    ws.onopen = () => {
      connected = true;
      addOk("connected " + wsUrl);
      lastAction = "connected";
      syncUI();
    };

    ws.onclose = () => {
      connected = false;
      joined = false;
      ws = null;
      pendingDiceUI = [];
      selectedPendingIdx = 0;
      lastMoves = [];
      renderMoves([]);
      renderPendingDiceList();
      addWarn("disconnected");
      lastAction = "disconnected";
      syncUI();
    };

    ws.onerror = () => {
      addErr("ws error (see console)");
      lastAction = "ERR ws error";
      syncUI();
    };

    ws.onmessage = (ev) => {
      try{
        handleMsg(JSON.parse(String(ev.data)));
      }catch(e){
        addErr("parse error: " + String(e));
      }
    };

    syncUI();
  };

  btnDisconnectEl.onclick = () => { if (ws) ws.close(); };

  btnHelloEl.onclick = () => {
    const clientId = (clientIdEl.value || "").trim();
    sendRaw(clientId ? { type: "hello", clientId } : { type: "hello" });
    lastAction = "hello";
    syncUI();
  };

  btnJoinEl.onclick = () => {
    const roomCode = (roomCodeEl.value || "").trim();
    const claimPlayerId = (claimPlayerIdEl.value || "").trim();
    sendRaw({
      type: "joinRoom",
      roomCode: roomCode || undefined,
      claimPlayerId: claimPlayerId || undefined,
    });
    lastAction = "joinRoom";
    syncUI();
  };

  btnReadyTrueEl.onclick = () => {
    sendRaw({ type: "setReady", ready: true });
    lastAction = "setReady true";
    syncUI();
  };

  btnReadyFalseEl.onclick = () => {
    sendRaw({ type: "setReady", ready: false });
    lastAction = "setReady false";
    syncUI();
  };

  btnApplyLobbyConfigEl.onclick = () => {
    const playerCount = Number((playerCountEl.value || "").trim());
    if (!Number.isFinite(playerCount) || playerCount <= 0){
      lastLobbyError = "CLIENT: Invalid playerCount. Must be a positive number.";
      lastAction = "ERR invalid lobby playerCount";
      syncUI();
      return;
    }

    const gameConfig = { playerCount: playerCount };

    gameConfig.doubleDice = !!optDoubleDiceEl.checked;
    gameConfig.killRoll = !!optKillRollEl.checked;

    if (optTeamPlayEl.checked){
      gameConfig.teamPlay = true;
      const tc = Number((teamCountEl.value || "").trim());
      if (Number.isFinite(tc) && tc > 0){
        gameConfig.teamCount = tc;
      } else {
        // default for team play
        gameConfig.teamCount = 2;
      }

      if (playerCount % 2 !== 0){
        // This is a client-side warning; server will simply never lock teams for odd counts.
        lastLobbyError = "CLIENT: teamPlay requires even playerCount for a 2-team split (lock gate).";
      } else {
        lastLobbyError = "";
      }
    } else {
      lastLobbyError = "";
    }

    const bo = (boardOverrideEl.value || "").trim();
    if (bo === "4" || bo === "6" || bo === "8"){
      gameConfig.boardArmCount = Number(bo);
    }

    sendRaw({ type: "setLobbyGameConfig", gameConfig });
    lastAction = "setLobbyGameConfig " + JSON.stringify(gameConfig);
    syncUI();
  };

  btnStartEl.onclick = () => {
    const playerCount = Number((playerCountEl.value || "").trim());
    if (!Number.isFinite(playerCount) || playerCount <= 0){
      addErr("Invalid playerCount. Must be a positive number.");
      lastAction = "ERR invalid playerCount";
      syncUI();
      return;
    }

    const options = {};
    options.doubleDice = !!optDoubleDiceEl.checked;
    options.killRoll = !!optKillRollEl.checked;

    if (optTeamPlayEl.checked){
      options.teamPlay = true;
      const tc = Number((teamCountEl.value || "").trim());
      if (Number.isFinite(tc) && tc > 0) options.teamCount = tc;
    }

    const bo = (boardOverrideEl.value || "").trim();
    if (bo === "4" || bo === "6" || bo === "8"){
      options.boardOverride = Number(bo);
    }

    // Starting a new game resets all local resolve state.
    pendingDiceUI = [];
    selectedPendingIdx = 0;
    lastMoves = [];
    renderMoves([]);
    moveIndexEl.value = "";
    renderPendingDiceList();

    sendRaw({ type: "startGame", playerCount, options });
    lastAction = "startGame playerCount=" + playerCount + " options=" + JSON.stringify(options);

    optDoubleDiceServer = null;
    resetRollSlots();
    renderRollDiceList();
    syncUI();
  };

  btnSubmitRollEl.onclick = () => {
    const actorId = (actorIdEl.value || "").trim();
    if (!actorId) return;

    const dice = rollSlots.slice().map(n => Number(n));
    if (!dice.length || !dice.every(n => Number.isFinite(n) && n>=1 && n<=6 && Math.floor(n)===n)){
      addErr("Invalid rollSlots; set each die 1-6.");
      lastAction = "ERR invalid rollSlots";
      syncUI();
      return;
    }

    // FIX B: Do NOT set pendingDiceUI optimistically on submit.
    // Wait for the server's subsequent legalMoves response to populate pendingDiceUI.
    selectedPendingIdx = 0;

    // Clear stale moves as we begin a new resolve set.
    lastMoves = [];
    renderMoves([]);
    moveIndexEl.value = "";

    sendRaw({ type: "roll", actorId, dice });
    lastAction = "roll dice=" + JSON.stringify(dice);

    // Do not auto-fetch moves here; the roll response should deliver legalMoves.
    syncUI();
  };

  btnClearRollEl.onclick = () => {
    resetRollSlots();
    renderRollDiceList();
    lastAction = "cleared roll slots";
    syncUI();
  };

  btnMoveEl.onclick = () => {
    const actorId = (actorIdEl.value || "").trim();
    const idx = Number(moveIndexEl.value);
    if (!actorId) return;
    if (!Number.isFinite(idx) || idx < 0 || idx >= lastMoves.length) return;
    if (!Array.isArray(pendingDiceUI) || pendingDiceUI.length === 0) return;

    const die = pendingDiceUI[Math.max(0, Math.min(selectedPendingIdx, pendingDiceUI.length-1))];

    // Always spend exactly one selected die.
    sendRaw({ type: "move", actorId, dice: [die], move: lastMoves[idx] });
    lastAction = "move idx=" + idx + " die=" + String(die);
    syncUI();
  };

  btnClearMovesEl.onclick = () => {
    lastMoves = [];
    renderMoves([]);
    moveIndexEl.value = "";
    lastAction = "cleared moves";
    syncUI();
  };

  optDoubleDiceEl.onchange = () => {
    resetRollSlots();
    renderRollDiceList();
    syncUI();
  };

  // Init
  resetRollSlots();
  renderRollDiceList();
  renderPendingDiceList();
  syncUI();
})();
</script>
</body>
</html>`;
}



function htmlBoard(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>LMR Board Viewer</title>
  <style>
    body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding:16px; max-width:1100px; margin:0 auto;}
    .row{display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;}
    label{font-size:12px; color:#444;}
    input{padding:8px; border:1px solid #bbb; border-radius:6px; min-width:220px;}
    button{padding:8px 12px; border:1px solid #444; border-radius:8px; cursor:pointer; background:#fff;}
    button.primary{background:#111; color:#fff; border-color:#111;}
    button:disabled{opacity:.45; cursor:not-allowed;}
    .pill{display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; border:1px solid #ccc; margin-left:8px;}
    .ok{border-color:#2e7d32;}
    .err{border-color:#c62828;}
    table{border-collapse:collapse; width:100%; margin-top:10px;}
    th, td{border:1px solid #ddd; padding:6px 8px; font-size:13px; text-align:left;}
    th{background:#f6f6f6;}
    .muted{color:#666; font-size:12px;}
    .playerTag{font-weight:600;}
  </style>
</head>
<body>
  <h2 style="margin:0 0 4px 0;">Board State Viewer</h2>
  <div class="muted">Read-only. Connects to the WS server and renders peg positions.</div>

  <div class="row" style="margin-top:14px;">
    <div style="flex:1; min-width:260px;">
      <label>WS URL</label><br/>
      <input id="wsUrl" value="ws://localhost:8787"/>
    </div>
    <div style="flex:1; min-width:180px;">
      <label>Room Code</label><br/>
      <input id="roomCode" placeholder="(leave blank to create/join default)"/>
    </div>
    <div style="flex:1; min-width:180px;">
      <label>claimPlayerId (optional)</label><br/>
      <input id="claimPlayerId" placeholder="p0 / p1 / ..."/>
    </div>
    <div>
      <button class="primary" id="btnConnect">Connect</button>
    </div>
    <div>
      <button id="btnDisconnect" disabled>Disconnect</button>
    </div>
  </div>

  <div class="row">
    <div style="flex:1;">
      <span class="muted">Status:</span>
      <span id="statusPill" class="pill">disconnected</span>
      <span class="muted" style="margin-left:10px;">actorId:</span>
      <span id="actorId" class="playerTag">(none)</span>
      <span class="muted" style="margin-left:10px;">room:</span>
      <span id="roomLabel" class="playerTag">(none)</span>
    </div>
  </div>

  <div style="margin-top:14px;">
    <h3 style="margin:0 0 8px 0;">Pegs (active + finished, plus newly captured)</h3>
    <div class="muted">Base pegs are hidden unless they were just captured since the previous update. Finished pegs are shown.</div>
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>Peg</th>
          <th>Zone</th>
          <th>Index / Detail</th>
          <th>Finished</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody id="tbody">
        <tr><td colspan="6" class="muted">No state yet.</td></tr>
      </tbody>
    </table>
  </div>

<script>
(() => {
  const wsUrlEl = document.getElementById("wsUrl");
  const roomCodeEl = document.getElementById("roomCode");
  const claimPlayerIdEl = document.getElementById("claimPlayerId");
  const btnConnectEl = document.getElementById("btnConnect");
  const btnDisconnectEl = document.getElementById("btnDisconnect");
  const statusPillEl = document.getElementById("statusPill");
  const actorIdEl = document.getElementById("actorId");
  const roomLabelEl = document.getElementById("roomLabel");
  const tbodyEl = document.getElementById("tbody");

  /** @type {WebSocket | null} */
  let ws = null;
  let connected = false;

  /** @type {any | null} */
  let lastState = null; // expects shape with .pegStates

  /** @type {any | null} */
  let prevPegStates = null;

  // base pegs that just got captured: key -> ttl updates remaining
  const transientBase = new Map();

  const PLAYER_COLOR = {
    p0: "dodgerblue",
    p1: "crimson",
    p2: "seagreen",
    p3: "goldenrod",
  };

  function setStatus(kind, text){
    statusPillEl.className = "pill " + (kind || "");
    statusPillEl.textContent = text;
  }

  function sendRaw(obj){
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(obj));
  }

  function extractNextState(msg){
    if (!msg || typeof msg !== "object") return null;

    // moveResult => response.result.nextState
    if (msg.type === "moveResult"){
      const ns = msg?.response?.result?.nextState;
      if (ns) return ns;
    }

    // stateSync => state (if present)
    if (msg.type === "stateSync"){
      const st = msg?.state;
      if (st) return st;
      const ns = msg?.nextState;
      if (ns) return ns;
    }

    // other messages might carry nextState similarly
    const ns = msg?.nextState;
    if (ns) return ns;

    return null;
  }

  function pegKey(playerId, pegIndex){
    return String(playerId) + "#" + String(pegIndex);
  }

  function computeTransientBase(currentPegStates){
    if (!prevPegStates) return;

    // Decrement existing
    for (const [k, ttl] of transientBase.entries()){
      if (ttl <= 1) transientBase.delete(k);
      else transientBase.set(k, ttl - 1);
    }

    // Detect newly captured (non-base -> base)
    for (const playerId of Object.keys(currentPegStates || {})){
      const arr = currentPegStates[playerId] || [];
      const prevArr = (prevPegStates && prevPegStates[playerId]) ? prevPegStates[playerId] : [];
      for (const peg of arr){
        const prevPeg = prevArr.find(p => p && p.pegIndex === peg.pegIndex);
        const prevZone = prevPeg && prevPeg.position ? prevPeg.position.zone : undefined;
        const curZone = peg && peg.position ? peg.position.zone : undefined;
        if (prevZone && prevZone !== "base" && curZone === "base"){
          transientBase.set(pegKey(playerId, peg.pegIndex), 1);
        }
      }
    }
  }

  function render(){
    const pegStates = lastState && lastState.pegStates ? lastState.pegStates : null;
    if (!pegStates){
      tbodyEl.innerHTML = '<tr><td colspan="6" class="muted">No state yet.</td></tr>';
      return;
    }

    const rows = [];

    for (const playerId of Object.keys(pegStates)){
      const pegs = pegStates[playerId] || [];
      for (const peg of pegs){
        if (!peg || !peg.position) continue;

        const zone = peg.position.zone;
        const finished = !!peg.isFinished;

        const key = pegKey(playerId, peg.pegIndex);
        const isTransientBase = transientBase.has(key);

        // Filtering:
        // - Show all finished pegs (regardless of zone; in practice they should not be base).
        // - Show active pegs (track/center/home) that are not finished.
        // - Hide base pegs unless transient (just captured).
        let include = false;
        let note = "";

        if (finished){
          include = true;
          note = "finished";
        } else if (zone === "track" || zone === "center" || zone === "home"){
          include = true;
        } else if (zone === "base" && isTransientBase){
          include = true;
          note = "captured";
        }

        if (!include) continue;

        let detail = "";
        if (zone === "track" && typeof peg.position.index === "number") detail = String(peg.position.index);
        else if (zone === "home" && typeof peg.position.index === "number") detail = String(peg.position.index);
        else if (zone === "base") detail = peg.position.playerId ? String(peg.position.playerId) : "";
        else detail = "";

        rows.push({
          playerId,
          pegIndex: peg.pegIndex,
          zone,
          detail,
          finished,
          note,
        });
      }
    }

    // Stable ordering: playerId then zone priority then index
    const zoneOrder = { track: 1, center: 2, home: 3, base: 9 };
    rows.sort((a,b) => {
      if (a.playerId !== b.playerId) return a.playerId < b.playerId ? -1 : 1;
      const za = zoneOrder[a.zone] ?? 99;
      const zb = zoneOrder[b.zone] ?? 99;
      if (za !== zb) return za - zb;
      const da = parseInt(a.detail, 10);
      const db = parseInt(b.detail, 10);
      if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db;
      return a.pegIndex - b.pegIndex;
    });

    if (rows.length === 0){
      tbodyEl.innerHTML = '<tr><td colspan="6" class="muted">No visible pegs by current filter.</td></tr>';
      return;
    }

    tbodyEl.innerHTML = rows.map(r => {
      const color = PLAYER_COLOR[r.playerId] || "#111";
      const playerCell = '<span class="playerTag" style="color:' + color + ';">' + r.playerId + '</span>';
      const finishedCell = r.finished ? "true" : "false";
      const noteCell = r.note ? r.note : "";
      return (
        "<tr>" +
          "<td>" + playerCell + "</td>" +
          "<td>" + String(r.pegIndex) + "</td>" +
          "<td>" + String(r.zone) + "</td>" +
          "<td>" + String(r.detail || "") + "</td>" +
          "<td>" + finishedCell + "</td>" +
          "<td>" + noteCell + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  btnConnectEl.onclick = () => {
    const wsUrl = (wsUrlEl.value || "").trim();
    if (!wsUrl) return;

    try{
      ws = new WebSocket(wsUrl);
    }catch(e){
      setStatus("err", "ws ctor failed");
      return;
    }

    ws.onopen = () => {
      connected = true;
      setStatus("ok", "connected");
      btnConnectEl.disabled = true;
      btnDisconnectEl.disabled = false;

      // auto-join immediately
      const roomCode = (roomCodeEl.value || "").trim();
      const claimPlayerId = (claimPlayerIdEl.value || "").trim();
      sendRaw({
        type: "joinRoom",
        roomCode: roomCode || undefined,
        claimPlayerId: claimPlayerId || undefined,
      });
    };

    ws.onclose = () => {
      connected = false;
      setStatus("", "disconnected");
      btnConnectEl.disabled = false;
      btnDisconnectEl.disabled = true;
    };

    ws.onerror = () => {
      setStatus("err", "ws error");
    };

    ws.onmessage = (ev) => {
      let msg = null;
      try{ msg = JSON.parse(ev.data); }catch(_e){ return; }

      if (msg && msg.type === "roomJoined"){
        actorIdEl.textContent = String(msg.actorId || "(none)");
        roomLabelEl.textContent = String(msg.roomCode || msg.room || "(none)");
      }

      const ns = extractNextState(msg);
      if (ns && ns.pegStates){
        computeTransientBase(ns.pegStates);
        prevPegStates = ns.pegStates;
        lastState = ns;
        render();
      }
    };
  };

  btnDisconnectEl.onclick = () => {
    if (ws) ws.close();
  };

  setStatus("", "disconnected");
})();
</script>
</body>
</html>`;
}
