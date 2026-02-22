#!/usr/bin/env node
/**
 * renderMilestones.mjs
 *
 * Canonical input:
 *   - ./MILESTONES.json (current truth)
 *   - ./MILESTONES.BASELINE.json (session baseline; tracked)
 *
 * Views:
 *   --view atomic   : one milestone per line; expands children for IN_PROGRESS only
 *   --view tree     : hierarchical tree; expands children for IN_PROGRESS only
 *   --view chart    : simple ASCII bar chart with ANSI colors (green/yellow/red)
 *
 * Diff:
 *   --diff <baselinePath> <currentPath>
 *     Prints status changes (id/title: baseline -> current).
 */

import fs from "node:fs";

const ANSI = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
};

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function colorForStatus(status) {
  switch (status) {
    case "COMPLETE": return ANSI.green;
    case "IN_PROGRESS": return ANSI.yellow;
    case "NOT_STARTED": return ANSI.red;
    default: return ANSI.reset;
  }
}

function statusToPct(status) {
  // Fixed mapping (status-only discipline).
  switch (status) {
    case "COMPLETE": return 100;
    case "IN_PROGRESS": return 50;
    case "NOT_STARTED": return 0;
    default: return 0;
  }
}

function flattenAll(milestones, out = []) {
  for (const m of milestones) {
    out.push(m);
    if (Array.isArray(m.children) && m.children.length) flattenAll(m.children, out);
  }
  return out;
}

function printAtomicLine(m, indent) {
  const pad = "  ".repeat(indent);
  const c = colorForStatus(m.status);
  const label = String(m.status).padEnd(11, " ");
  console.log(`${pad}${c}${label}${ANSI.reset} ${m.id} — ${m.title}`);
}

function renderAtomic(doc) {
  for (const m of doc.milestones) {
    printAtomicLine(m, 0);
    if (m.status === "IN_PROGRESS") {
      for (const c of (m.children ?? [])) printAtomicLine(c, 1);
    }
  }
}

function renderTree(doc) {
  for (const m of doc.milestones) {
    printTreeNode(m, "", true, 0);
  }
}

function printTreeNode(m, prefix, isLast, depth) {
  const branch = depth === 0 ? "" : (isLast ? "└─ " : "├─ ");
  const c = colorForStatus(m.status);
  const label = String(m.status).padEnd(11, " ");
  console.log(`${prefix}${branch}${c}${label}${ANSI.reset} ${m.id} — ${m.title}`);

  const expand = m.status === "IN_PROGRESS";
  const kids = expand ? (m.children ?? []) : [];
  const nextPrefix = depth === 0 ? "" : (prefix + (isLast ? "   " : "│  "));
  kids.forEach((k, idx) => {
    const last = idx === kids.length - 1;
    printTreeNode(k, nextPrefix, last, depth + 1);
  });
}

function renderChart(doc) {
  const width = 20;
  for (const m of doc.milestones) {
    const pct = statusToPct(m.status);
    const filled = Math.round((pct / 100) * width);
    const bar = "█".repeat(filled) + " ".repeat(width - filled);
    const c = colorForStatus(m.status);
    console.log(`${m.id.padEnd(10)} ${c}${bar}${ANSI.reset} ${String(pct).padStart(3)}%  ${m.title}`);

    if (m.status === "IN_PROGRESS") {
      for (const cM of (m.children ?? [])) {
        const p2 = statusToPct(cM.status);
        const f2 = Math.round((p2 / 100) * width);
        const b2 = "█".repeat(f2) + " ".repeat(width - f2);
        const cc = colorForStatus(cM.status);
        console.log(`  ${cM.id.padEnd(8)} ${cc}${b2}${ANSI.reset} ${String(p2).padStart(3)}%  ${cM.title}`);
      }
    }
  }
}

function diffDocs(base, curr) {
  const baseMap = new Map(flattenAll(base.milestones).map((m) => [m.id, m]));
  const currMap = new Map(flattenAll(curr.milestones).map((m) => [m.id, m]));

  const allIds = Array.from(new Set([...baseMap.keys(), ...currMap.keys()])).sort();
  const changes = [];

  for (const id of allIds) {
    const b = baseMap.get(id);
    const c = currMap.get(id);
    if (!b || !c) {
      changes.push({ kind: !b ? "ADDED" : "REMOVED", id, b, c });
      continue;
    }
    if (b.status !== c.status || b.title !== c.title) {
      changes.push({ kind: "CHANGED", id, b, c });
    }
  }

  if (changes.length === 0) {
    console.log(`${ANSI.green}NO MILESTONE DELTAS${ANSI.reset}`);
    return;
  }

  console.log(`${ANSI.yellow}MILESTONE DELTAS${ANSI.reset}`);
  for (const ch of changes) {
    if (ch.kind === "ADDED") {
      console.log(`${ANSI.green}ADDED${ANSI.reset} ${ch.c.id} — ${ch.c.title} (${ch.c.status})`);
    } else if (ch.kind === "REMOVED") {
      console.log(`${ANSI.red}REMOVED${ANSI.reset} ${ch.b.id} — ${ch.b.title} (${ch.b.status})`);
    } else {
      const bS = ch.b.status;
      const cS = ch.c.status;
      const arrow = bS === cS ? "→" : "=>";
      console.log(`${ch.id} — ${ch.c.title}: ${colorForStatus(bS)}${bS}${ANSI.reset} ${arrow} ${colorForStatus(cS)}${cS}${ANSI.reset}`);
    }
  }
}

function usage(exitCode = 1) {
  console.log("Usage:");
  console.log("  node ./renderMilestones.mjs --view atomic|tree|chart [--file <path>]");
  console.log("  node ./renderMilestones.mjs --diff <baselinePath> <currentPath>");
  process.exit(exitCode);
}

const args = process.argv.slice(2);
if (args.length === 0) usage(1);

if (args[0] === "--view") {
  const view = args[1];
  if (!view) usage(1);

  const fileIdx = args.indexOf("--file");
  const filePath = fileIdx >= 0 ? args[fileIdx + 1] : "./MILESTONES.json";

  const doc = readJson(filePath);

  if (view === "atomic") renderAtomic(doc);
  else if (view === "tree") renderTree(doc);
  else if (view === "chart") renderChart(doc);
  else usage(1);

  process.exit(0);
}

if (args[0] === "--diff") {
  const basePath = args[1];
  const currPath = args[2];
  if (!basePath || !currPath) usage(1);
  const base = readJson(basePath);
  const curr = readJson(currPath);
  diffDocs(base, curr);
  process.exit(0);
}

usage(1);
