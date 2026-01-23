// src/server/httpConsole.ts
//
// FULL FILE REPLACEMENT.
//
// Fixes:
// - Removes TypeScript annotations from browser JS (prevents SyntaxError).
// - Correctly interprets moveResult payload: uses msg.response.ok (per protocol.ts).
// - White/legible UI.
// - Individual dice lines.
// - Die-resolution order choice.
// - "Last moveResult" box persists moveResult even if stateSync arrives immediately.

import http, { type IncomingMessage, type ServerResponse } from "node:http";

export function startHttpConsole(...args: any[]) {
  const first = args[0];
  const second = args[1];

  let port = 8788;
  let host: string | undefined = undefined;

  if (typeof first === "number") {
    port = first;
    if (typeof second === "string") host = second;
  } else if (first && typeof first === "object") {
    if (typeof first.httpPort === "number") port = first.httpPort;
    else if (typeof first.port === "number") port = first.port;
    if (typeof first.host === "string") host = first.host;
  }

  const server = http.createServer((req, res) => serveHttpConsole(req, res));
  server.listen(port, host);
  return server;
}

export function serveHttpConsole(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || "/";
  if (url === "/" || url.startsWith("/?")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html());
    return;
  }

  if (url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
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
  </style>
</head>
<body>
  <div class="row" style="justify-content:space-between;">
    <div>
      <h2 style="margin:0 0 6px 0;">LMR - Game Console</h2>
      <div class="small">White theme + individual dice lines (Double Dice verification)</div>
    </div>
    <div class="small mono">http://localhost:8788</div>
  </div>

  <div class="grid" style="margin-top:12px;">
    <div class="card">
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

      <div class="divider"></div>

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

      <div class="row" style="margin-top:6px;">
        <button id="btnReadyTrue" disabled>Ready: true</button>
        <button id="btnReadyFalse" disabled>Ready: false</button>
        <button id="btnStart" disabled class="primary">Start</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Turn / Dice Panel</h3>

      <div class="kv mono">
        <div>nextActorId</div><div id="nextActorId">(unknown)</div>
        <div>awaitingDice</div><div id="awaitingDice">(unknown)</div>
        <div>doubleDice (server)</div><div id="doubleDice">(unknown)</div>
        <div>doubleDice (effective)</div><div id="doubleDiceEff">(unknown)</div>
        <div>bankedExtra</div><div id="bankedExtra">(unknown)</div>
        <div>eligibleToRoll</div><div id="eligibleToRoll">(unknown)</div>
        <div>eligibleToResolve</div><div id="eligibleToResolve">(unknown)</div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <span class="pill" id="lastActionPill">lastAction</span>
        <span class="small mono" id="lastActionText">(none)</span>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Roll Dice (individual lines)</h3>
      <div class="small">Select a die slot, set its value, then Submit Roll.</div>
      <div style="margin-top:8px;">
        <div class="diceList" id="rollDiceList"></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button id="btnSubmitRoll" disabled class="primary">Submit Roll</button>
        <button id="btnClearRoll" disabled>Clear Roll</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Resolve Dice (order choice)</h3>
      <div class="small">Select which pending die to resolve first, then Get Moves.</div>
      <div style="margin-top:8px;">
        <div class="diceList" id="pendingDiceList"></div>
      </div>

      <div class="row" style="margin-top:10px;">
        <button id="btnGetMoves" disabled class="primary">Get Moves (selected die)</button>
      </div>

      <div class="divider"></div>

      <h3 style="margin:0 0 10px 0;">Apply Move</h3>
      <div class="row">
        <div style="flex:1;">
          <label>Move Index</label><br/>
          <input id="moveIndex" style="width:100%;" placeholder="click a move below" />
        </div>
      </div>
      <div class="row" style="margin-top:8px;">
        <button id="btnMove" disabled class="primary">Send Move</button>
        <button id="btnClearMoves" disabled>Clear Moves</button>
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

  const btnConnectEl = document.getElementById("btnConnect");
  const btnDisconnectEl = document.getElementById("btnDisconnect");
  const btnHelloEl = document.getElementById("btnHello");
  const btnJoinEl = document.getElementById("btnJoin");
  const btnReadyTrueEl = document.getElementById("btnReadyTrue");
  const btnReadyFalseEl = document.getElementById("btnReadyFalse");
  const btnStartEl = document.getElementById("btnStart");

  const btnSubmitRollEl = document.getElementById("btnSubmitRoll");
  const btnClearRollEl = document.getElementById("btnClearRoll");

  const btnGetMovesEl = document.getElementById("btnGetMoves");
  const btnMoveEl = document.getElementById("btnMove");
  const btnClearMovesEl = document.getElementById("btnClearMoves");

  const lastActionTextEl = document.getElementById("lastActionText");
  const lastActionPillEl = document.getElementById("lastActionPill");
  const movesBodyEl = document.getElementById("movesBody");

  const nextActorIdEl = document.getElementById("nextActorId");
  const awaitingDiceEl = document.getElementById("awaitingDice");
  const doubleDiceEl = document.getElementById("doubleDice");
  const doubleDiceEffEl = document.getElementById("doubleDiceEff");
  const bankedExtraEl = document.getElementById("bankedExtra");
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

  let lastMoves = [];
  let lastAction = "";

  let rollSlots = [];
  let selectedRollSlot = 0;

  let pendingDice = [];
  let selectedPendingIdx = 0;

  let turnNextActorId = null;
  let turnAwaitingDice = null;
  let optDoubleDiceServer = null;
  let bankedExtra = null;

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
    return effectiveDoubleDice() ? 2 : 1;
  }

  function resetRollSlots(){
    rollSlots = new Array(dicePerRoll()).fill(null);
    selectedRollSlot = 0;
  }

  function renderRollDiceList(){
    rollDiceListEl.innerHTML = "";

    const n = dicePerRoll();
    if (!Array.isArray(rollSlots) || rollSlots.length !== n) resetRollSlots();

    for (let i=0;i<n;i++){
      const row = document.createElement("div");
      row.className = "diceRow";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "rollSlot";
      radio.checked = (i === selectedRollSlot);
      radio.onchange = () => { selectedRollSlot = i; syncUI(); };
      row.appendChild(radio);

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

    if (!Array.isArray(pendingDice) || pendingDice.length === 0){
      const row = document.createElement("div");
      row.className = "diceRow";
      row.style.gridTemplateColumns = "28px 1fr";
      const spacer = document.createElement("div");
      spacer.textContent = "";
      const msg = document.createElement("div");
      msg.textContent = "(no pending dice)";
      row.appendChild(spacer);
      row.appendChild(msg);
      pendingDiceListEl.appendChild(row);
      return;
    }

    if (selectedPendingIdx < 0 || selectedPendingIdx >= pendingDice.length) selectedPendingIdx = 0;

    for (let i=0;i<pendingDice.length;i++){
      const row = document.createElement("div");
      row.className = "diceRow";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "pendingDie";
      radio.checked = (i === selectedPendingIdx);
      radio.onchange = () => { selectedPendingIdx = i; syncUI(); };
      row.appendChild(radio);

      const label = document.createElement("div");
      label.textContent = "Pending Die " + (i+1);
      row.appendChild(label);

      const val = document.createElement("div");
      val.className = "diceValue right";
      val.textContent = String(pendingDice[i]);
      row.appendChild(val);

      const hint = document.createElement("div");
      hint.className = "small right";
      hint.textContent = (i === selectedPendingIdx) ? "selected" : "";
      row.appendChild(hint);

      pendingDiceListEl.appendChild(row);
    }
  }

  function reorderDiceWithSelectedFirst(dice, selectedIdx){
    if (!Array.isArray(dice) || dice.length === 0) return [];
    const idx = Math.max(0, Math.min(selectedIdx ?? 0, dice.length-1));
    const first = dice[idx];
    const rest = [];
    for (let i=0;i<dice.length;i++){
      if (i !== idx) rest.push(dice[i]);
    }
    return [first, ...rest];
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

  function extractTurnFields(msg){
    const t =
      msg.turn ??
      msg.game?.turn ??
      msg.state?.turn ??
      msg.stateSync?.turn ??
      deepGet(msg, ["game","turn"]);

    if (t && typeof t === "object"){
      if (typeof t.nextActorId === "string") turnNextActorId = t.nextActorId;
      if (typeof t.awaitingDice === "boolean") turnAwaitingDice = t.awaitingDice;
    }

    const dd =
      msg.game?.options?.doubleDice ??
      msg.game?.opts?.doubleDice ??
      msg.state?.game?.options?.doubleDice ??
      msg.state?.game?.opts?.doubleDice ??
      msg.options?.doubleDice ??
      deepGet(msg, ["game","config","doubleDice"]) ??
      deepGet(msg, ["game","settings","doubleDice"]);

    if (typeof dd === "boolean") optDoubleDiceServer = dd;

    const b =
      msg.turn?.bankedExtraRolls ??
      msg.turn?.bankedExtra ??
      msg.turn?.extraRollsBanked ??
      msg.turn?.pendingExtraRolls ??
      msg.game?.turn?.bankedExtraRolls ??
      msg.state?.turn?.bankedExtraRolls ??
      msg.state?.turn?.bankedExtra ??
      undefined;

    if (typeof b === "number" && Number.isFinite(b)) bankedExtra = b;

    if (bankedExtra === null || bankedExtra === undefined){
      const foundObj = deepFindFirst(msg, (o) => {
        return Object.prototype.hasOwnProperty.call(o, "bankedExtraRolls") ||
               Object.prototype.hasOwnProperty.call(o, "bankedExtra") ||
               Object.prototype.hasOwnProperty.call(o, "pendingExtraRolls");
      });
      if (foundObj){
        const v = foundObj.bankedExtraRolls ?? foundObj.bankedExtra ?? foundObj.pendingExtraRolls;
        if (typeof v === "number" && Number.isFinite(v)) bankedExtra = v;
      }
    }
  }

  function syncTurnPanel(){
    nextActorIdEl.textContent = (turnNextActorId ?? "(unknown)");
    awaitingDiceEl.textContent = (turnAwaitingDice === null ? "(unknown)" : String(turnAwaitingDice));
    doubleDiceEl.textContent = (typeof optDoubleDiceServer === "boolean") ? String(optDoubleDiceServer) : "(unknown)";
    doubleDiceEffEl.textContent = String(effectiveDoubleDice());

    bankedExtraEl.textContent = (bankedExtra === null || bankedExtra === undefined) ? "(unknown)" : String(bankedExtra);

    const eligibleToRoll = (turnAwaitingDice === true);
    const eligibleToResolve = Array.isArray(pendingDice) && pendingDice.length > 0;

    eligibleToRollEl.textContent = eligibleToRoll ? ("YES (roll " + dicePerRoll() + ")") : "NO";
    eligibleToResolveEl.textContent = eligibleToResolve ? "YES" : "NO";
  }

  function syncUI(){
    btnDisconnectEl.disabled = !connected;
    btnConnectEl.disabled = connected;

    btnHelloEl.disabled = !connected;
    btnJoinEl.disabled = !connected;

    btnReadyTrueEl.disabled = !joined;
    btnReadyFalseEl.disabled = !joined;
    btnStartEl.disabled = !joined;

    const canRollNow = joined && (turnAwaitingDice === true);
    btnSubmitRollEl.disabled = !canRollNow || !rollSlots.every(v => Number.isFinite(v) && v>=1 && v<=6);
    btnClearRollEl.disabled = !canRollNow;

    btnGetMovesEl.disabled = !(joined && Array.isArray(pendingDice) && pendingDice.length > 0);

    const idx = Number(moveIndexEl.value);
    btnMoveEl.disabled = !(joined && Number.isFinite(idx) && idx>=0 && idx<lastMoves.length);

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
    syncTurnPanel();
  }

  function sendRaw(obj){
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(obj));
  }

  function handleMsg(msg){
    setRaw(msg);

    if (!msg || typeof msg.type !== "string"){
      addWarn("Unknown msg: " + JSON.stringify(msg));
      return;
    }

    if (msg.type === "error"){
      lastAction = "ERR " + (msg.code || "error") + " " + (msg.message || "");
      addErr("server error: " + JSON.stringify(msg));
      syncUI();
      return;
    }

    if (msg.type === "welcome"){
      addOk("welcome serverVersion=" + (msg.serverVersion || "?"));
      lastAction = "welcome";
      syncUI();
      return;
    }

    if (msg.type === "roomJoined"){
      joined = true;
      if (msg.roomCode) roomCodeEl.value = msg.roomCode;
      if (msg.playerId) actorIdEl.value = msg.playerId;
      lastAction = "roomJoined";
      addOk("roomJoined room=" + msg.roomCode + " actorId=" + msg.playerId);
      syncUI();
      return;
    }

    if (msg.type === "lobbySync"){
      lastAction = "lobbySync";
      extractTurnFields(msg);
      syncUI();
      return;
    }

    if (msg.type === "stateSync"){
      lastAction = "stateSync";
      extractTurnFields(msg);

      renderRollDiceList();

      if (turnAwaitingDice === true){
        pendingDice = [];
        lastMoves = [];
        renderMoves([]);
        moveIndexEl.value = "";
        resetRollSlots();
        renderRollDiceList();
        renderPendingDiceList();
      }

      syncUI();
      return;
    }

    if (msg.type === "legalMoves"){
      lastMoves = msg.moves || [];
      const dice = Array.isArray(msg.dice) ? msg.dice : (typeof msg.die === "number" ? [msg.die] : []);
      pendingDice = Array.isArray(dice) ? dice.slice() : [];
      renderPendingDiceList();
      renderMoves(lastMoves);
      lastAction = "legalMoves pendingDice=" + JSON.stringify(pendingDice) + " moves=" + lastMoves.length;
      syncUI();
      return;
    }

    if (msg.type === "moveResult"){
      const r = msg.response;
      lastMoveResultEl.value = JSON.stringify(msg, null, 2);

      const ok = !!(r && typeof r === "object" && r.ok === true);
      lastAction = "moveResult ok=" + String(ok);
      addOk("moveResult ok=" + String(ok));

      if (!ok){
        try{
          const reason = (r && typeof r === "object") ? (r.reason || r.error || r.message) : undefined;
          if (reason) addErr("moveResult reason: " + String(reason));
        }catch(_){}
      }

      syncUI();
      return;
    }

    lastAction = msg.type;
    extractTurnFields(msg);
    syncUI();
  }

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

    sendRaw({ type: "startGame", playerCount, options });
    lastAction = "startGame playerCount=" + playerCount + " options=" + JSON.stringify(options);

    optDoubleDiceServer = null;
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

    sendRaw({ type: "roll", actorId, dice });
    lastAction = "roll dice=" + JSON.stringify(dice);
    syncUI();
  };

  btnClearRollEl.onclick = () => {
    resetRollSlots();
    renderRollDiceList();
    lastAction = "cleared roll slots";
    syncUI();
  };

  btnGetMovesEl.onclick = () => {
    const actorId = (actorIdEl.value || "").trim();
    if (!actorId) return;
    if (!Array.isArray(pendingDice) || pendingDice.length === 0) return;

    const dice = reorderDiceWithSelectedFirst(pendingDice, selectedPendingIdx);
    sendRaw({ type: "getLegalMoves", actorId, dice });
    lastAction = "getLegalMoves dice=" + JSON.stringify(dice);
    syncUI();
  };

  btnMoveEl.onclick = () => {
    const actorId = (actorIdEl.value || "").trim();
    const idx = Number(moveIndexEl.value);
    if (!actorId) return;
    if (!Number.isFinite(idx) || idx < 0 || idx >= lastMoves.length) return;
    if (!Array.isArray(pendingDice) || pendingDice.length === 0) return;

    const dice = reorderDiceWithSelectedFirst(pendingDice, selectedPendingIdx);
    sendRaw({ type: "move", actorId, dice, move: lastMoves[idx] });
    lastAction = "move idx=" + idx + " dice=" + JSON.stringify(dice);
    syncUI();
  };

  btnClearMovesEl.onclick = () => {
    lastMoves = [];
    renderMoves([]);
    moveIndexEl.value = "";
    lastAction = "cleared moves";
    syncUI();
  };

  // Init
  resetRollSlots();
  renderRollDiceList();
  renderPendingDiceList();
  syncUI();

  optDoubleDiceEl.onchange = () => { resetRollSlots(); renderRollDiceList(); syncUI(); };

})();
</script>
</body>
</html>`;
}
