// brand casts for tests
export const P = (s) => s;
export const G = (s) => s;
export function makeBase(playerId) {
    return { zone: "base", playerId };
}
export function makeTrack(index) {
    return { zone: "track", index };
}
export function makeHome(playerId, index) {
    return { zone: "home", playerId, index };
}
export function makeInitialPegs(playerId) {
    return [
        { pegIndex: 0, position: makeBase(playerId), isFinished: false },
        { pegIndex: 1, position: makeBase(playerId), isFinished: false },
        { pegIndex: 2, position: makeBase(playerId), isFinished: false },
        { pegIndex: 3, position: makeBase(playerId), isFinished: false },
    ];
}
export function makeState(args) {
    const { playerCount, currentSeat = 0, doubleDice = false } = args;
    const playerIds = Array.from({ length: playerCount }, (_, i) => P(`p${i}`));
    const players = Object.fromEntries(playerIds.map((pid, seat) => [
        pid,
        {
            playerId: pid,
            displayName: `Player ${seat}`,
            seat,
            isReady: true,
            hasFinished: false,
        },
    ]));
    const pegStates = Object.fromEntries(playerIds.map((pid) => [pid, makeInitialPegs(pid)]));
    return {
        gameId: G("g_test"),
        phase: "active",
        config: {
            playerCount,
            options: { doubleDice },
        },
        players,
        pegStates,
        turn: {
            currentPlayerId: playerIds[currentSeat],
            roll: { status: "idle" },
            legalMovesVersion: 0,
        },
        finishedOrder: [],
    };
}
export function setPeg(state, playerId, pegIndex, position, isFinished = false) {
    const next = { ...state, pegStates: { ...state.pegStates } };
    const pegs = next.pegStates[playerId].map((p) => p.pegIndex === pegIndex ? { ...p, position, isFinished } : p);
    next.pegStates[playerId] = pegs;
    return next;
}
export function findPeg(state, playerId, pegIndex) {
    const p = state.pegStates[playerId].find((x) => x.pegIndex === pegIndex);
    if (!p)
        throw new Error("peg not found");
    return p;
}
