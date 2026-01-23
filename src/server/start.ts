import { startWsServer } from "./wsServer";
import { createInitialState } from "./initialState";

async function main() {
  const port = Number(process.env.PORT ?? 8787);

  // Production path: require an implemented initializer.
  // Dev path: allow using test helper state factory without a hard runtime import.
  let initialState: any;

  if (process.env.NODE_ENV === "production") {
    initialState = createInitialState(Number(process.env.PLAYER_COUNT ?? 2));
  } else {
    // Dev-only fallback: dynamic import from test helpers.
    // This avoids a hard runtime dependency in production builds.
    const mod: any = await import("../../test/helpers");
    initialState = mod.makeState({ playerCount: Number(process.env.PLAYER_COUNT ?? 2) });
  }

  const server = startWsServer({ port, initialState, broadcast: true });
  // eslint-disable-next-line no-console
  console.log(`LMR WS server listening on ws://localhost:${server.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
