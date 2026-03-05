LMR Server ↔ UI Contract

Version: v0
Status: Derived from running server behavior
Source: wsServer.ts and handleMessage.ts

1. Transport

Protocol: WebSocket

All messages are JSON.

Client → Server
{
  "type": "messageType",
  "reqId": "optional-correlation-id",
  "...payload..."
}
Server → Client
{
  "type": "messageType",
  "reqId": "echoed-if-present",
  "...payload..."
}

reqId is optional but echoed if present.

2. Message Flow Overview

Typical gameplay flow:

connect
  → welcome

hello
  → welcome

joinRoom
  → roomJoined
  → lobbySync
  → stateSync (if game active)

setLobbyGameConfig
setTeam
setReady
startGame
  → stateSync

roll
  → legalMoves

move
  → moveResult

(state changes)
  → stateSync
3. Client → Server Messages
hello

Handshake.

{
  "type": "hello",
  "clientId": "optional"
}

Response:

welcome
joinRoom

Join an existing room or create a new one.

{
  "type": "joinRoom",
  "roomCode": "optional",
  "claimPlayerId": "optional"
}

Response sequence:

roomJoined
lobbySync
stateSync (if active game)
leaveRoom

Leave lobby.

{
  "type": "leaveRoom"
}

Restrictions:

Only allowed in lobby phase.

setLobbyGameConfig

Configure lobby game settings.

{
  "type": "setLobbyGameConfig",
  "gameConfig": {
    "playerCount": 4,
    "teamPlay": true,
    "teamCount": 2,
    "doubleDice": true,
    "killRoll": false
  }
}

Response:

lobbySync
setTeam

Move player to team.

{
  "type": "setTeam",
  "team": "A"
}

Restrictions:

Lobby phase only

Team play enabled

Teams not locked

Response:

lobbySync
setReady

Player ready state.

{
  "type": "setReady",
  "ready": true
}

Response:

lobbySync
startGame

Start the game.

{
  "type": "startGame",
  "playerCount": 4,
  "options": {
    "teamPlay": true,
    "doubleDice": true,
    "killRoll": false
  }
}

Response:

lobbySync
stateSync
roll

Submit dice roll.

{
  "type": "roll",
  "actorId": "p0",
  "dice": [1,6]
}

Legacy format allowed:

{
  "type": "roll",
  "actorId": "p0",
  "die": 6
}

Response:

legalMoves

or

stateSync

if auto-pass.

getLegalMoves

Query available moves.

{
  "type": "getLegalMoves",
  "actorId": "p0",
  "dice": [3]
}

Response:

legalMoves
move

Execute a move.

{
  "type": "move",
  "actorId": "p0",
  "dice": [1],
  "move": "enter:p0:0:1"
}

move must equal the id field of one of the previously returned legalMoves.moves.

Response:

moveResult
assignPendingDie

Team play delegation.

{
  "type": "assignPendingDie",
  "actorId": "p0",
  "dieIndex": 0,
  "controllerId": "p1"
}

Response:

stateSync
forfeitPendingDie

Global stuck resolution.

{
  "type": "forfeitPendingDie",
  "actorId": "p0"
}

Allowed only when no pending die has legal moves.

Response:

stateSync
rematchConsent

Used after game ends.

{
  "type": "rematchConsent",
  "consent": true
}
4. Server → Client Messages
welcome
{
  "type": "welcome",
  "serverVersion": "lmr-ws",
  "clientId": "client-id"
}
roomJoined
{
  "type": "roomJoined",
  "roomCode": "ABC123",
  "clientId": "clientX",
  "playerId": "p0",
  "reconnected": false
}
lobbySync
{
  "type": "lobbySync",
  "lobby": {
    "roomCode": "ABC123",
    "phase": "lobby",
    "expectedPlayerCount": 4,
    "players": [
      {
        "playerId": "p0",
        "clientId": "clientX",
        "seat": 0,
        "ready": false
      }
    ],
    "gameConfig": {}
  }
}
stateSync

Full authoritative game state.

{
  "type": "stateSync",
  "roomCode": "ABC123",
  "gameSeq": 0,
  "state": { },
  "stateHash": "abcdef",
  "turn": {
    "nextActorId": "p0",
    "awaitingDice": true,
    "pendingDice": [
      { "value": 3, "controllerId": "p0" }
    ],
    "bankedDice": 1
  }
}
Important UI fields
Field	Meaning
nextActorId	player whose turn it is
awaitingDice	roll allowed
pendingDice	dice waiting resolution
bankedDice	extra dice owed
legalMoves
{
  "type": "legalMoves",
  "roomCode": "ABC123",
  "actorId": "p0",
  "dice": [1,6],
  "die": 1,
  "moves": [
    {
      "id": "enter:p0:0:1",
      "kind": "enter",
      "actorPlayerId": "p0",
      "pegIndex": 0,
      "from": { "zone": "base", "playerId": "p0" },
      "to": { "zone": "track", "index": 8 },
      "path": [],
      "captures": []
    }
  ],
  "turn": {
    "nextActorId": "p0",
    "awaitingDice": false,
    "dicePolicy": "external",
    "bankedDice": 2
  }
}
UI behavior

Render moves using:

moves[i].id

Additional fields allow richer UI visualization.

moveResult
{
  "type": "moveResult",
  "roomCode": "ABC123",
  "response": {
    "ok": true,
    "result": {}
  }
}
error
{
  "type": "error",
  "code": "NOT_YOUR_TURN",
  "message": "Not your turn"
}

Common error codes:

BAD_MESSAGE
NOT_YOUR_TURN
BAD_TURN_STATE
BAD_ROLL
LOBBY_LOCKED
ENDED_GAME
endgameTimer
{
  "type": "endgameTimer",
  "roomCode": "ABC123",
  "secondsRemaining": 120,
  "secondsTotal": 180
}
5. Core Contract Rules
Turn Ownership

Only turn.nextActorId may:

roll

request moves

assign dice

Dice Resolution

If pendingDice exists:

roll is forbidden

exactly one die must be used for move

Banked Dice

If bankedDice > 0:

the roller keeps the turn

the next roll must consume the bank

Delegation

In team play:

dice may be assigned to teammates

only the turn owner assigns

Forfeit

forfeitPendingDie allowed only when:

no pending die has legal moves
6. UI Design Implications

Server is authoritative

UI must treat stateSync as the canonical state

legalMoves may return zero moves

UI must explicitly call forfeitPendingDie in that case

move.id is the canonical move token

End of Contract v0