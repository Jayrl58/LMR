import { createInitialState } from "./initialState";
import { startWsServer } from "./wsServer";

async function main() {
  const port = Number(process.env.PORT ?? 8787);

  // Use the real engine initializer in all environments.
  const initialState = createInitialState(Number(process.env.PLAYER_COUNT ?? 2));

  const server = startWsServer({ port, initialState, broadcast: true });
  // eslint-disable-next-line no-console
  console.log(`LMR WS server listening on ws://localhost:${server.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
