# LMR Banner, Disconnect, and Debug Panel Decisions — Implementation Reference

## 1. External Player & Room Entry
| Decision | Value / Behavior | Notes / Implementation |
|----------|-----------------|---------------------|
| Room creation | Immediate on Create Room | Assign owner, generate `LMR1` code and join link |
| Existing room | Reset on host Create Room | Clear players, lobby, in-progress game, reuse code |
| Entry path | Link-first with fallback | `/join?code=LMR1` + pre-join screen |
| Pre-join | Name only | Min 1 char testing, ≥3 production, alphanumeric, spaces trimmed, collapse multiple spaces, numeric allowed, no reserved names |
| Name uniqueness | Case-insensitive, duplicate rejected | Blocked until room reset |
| Returning player | Reclaim previous name if available | If taken, must enter new name |
| Game end | Lobby preserves names/settings | No clearing unless room reset |
| Disconnect | Players remain in current game | Waiting for reconnect or timeout |

## 2. Disconnect Handling & Timer
| Decision | Value / Behavior | Notes / Implementation |
|----------|-----------------|---------------------|
| Game pause | Immediately on disconnect | Overlay displayed, all players remain in-game |
| Timer | Initial 90s, extensions +60s x2 | Max 4.5 min total, host may end game anytime |
| Reconnect | Resume immediately | No intermediate screen, flash “Connection restored” 3s, top banner, green, global, text fades with background |
| Paused screen | Shows Awaiting player: <name> — MM:SS | Countdown visible to all, server-authoritative, absolute end timestamp, periodic sync 5s, snap immediately if drift |
| Kick | Non-team games only | Pieces returned to base, skip removed player in turn order, blocked from rejoining until room reset, overlay 3s, Back to Start button |
| Overlay | Full-screen, blocks interaction, dimmed background | Kicked message generic, no additional info |
| Chat | Enabled during pause | Players may communicate |

## 3. Banner Messages
| Decision | Value / Behavior | Notes / Implementation |
|----------|-----------------|---------------------|
| Position | Top-center, overlaps play area | Slightly transparent, flat, rounded corners, medium padding |
| Color | Success: green, Failure: red, Neutral: black | Fades with background during fade-out |
| Text | Center-aligned, same font, size variable, no icon | Static, no dynamic updates, min 3s display, max controlled per message |
| Lines | Multi-line allowed, wrap automatically, unlimited | No truncation |
| Queue | Unlimited, sequential per section | Duplicates not collapsed, messages follow strict queue order, independent per section |
| Fade | 500–700ms, same for all types | Auto-dismiss only, unaffected by hover or pause |
| ARIA | Accessible live region | Announcement triggers immediately |

## 4. Debug Panel
| Decision | Value / Behavior | Notes / Implementation |
|----------|-----------------|---------------------|
| Sections | system, game, server, lobby | Collapsed until first message, remain expanded, headers always visible |
| Message limit | 1000 messages | Retain timestamps, oldest dropped if exceeded |
| Scroll | Auto-scroll per section, independent from board | Fixed width, docked right, board unaffected |
| Clear | Button per section | Clears immediately, no confirmation |
| Logging | Enabled in debug mode only | Messages identical to production; for copy/paste review |
| Spacing | Uniform, no lines | Permanent expansion once message appears |
| Style | Minimal | Primary for developer clarity; secondary to player UX |

## 5. Banner & Disconnect Flow — Event Outline
- **Disconnect occurs** → game pauses → overlay appears → banner shows “Awaiting player…” (black) → timer counts down (MM:SS, server authoritative) → host may Extend/End → reconnect: flash “Connection restored” (green) 3s → resume game immediately.  
- **Kick flow** (non-team): player removed → pieces returned to base → overlay “You were removed from the game” 3s → Back to Start button → redirect immediate.  
- **Banner sequence**: queued per section → displayed sequentially → auto-dismiss after message duration (≥3s) → fade 500–700ms.  

## 6. Implementation Notes / Guidelines
- All timers, overlays, and banner displays remain **consistent between debug and production**, except debug adds logging.  
- Debug panel sections scroll independently, auto-scroll new messages, and retain messages up to 1000.  
- Visual styling: banners overlap board, top-center, slightly transparent, green/red/black, static text, rounded corners, medium padding, fade-out with text, minimum display 3s, multiple lines wrapped.  
- Disconnect overlays and banners do not block interaction beyond specified overlay rules.  
- All decisions remain **open for final