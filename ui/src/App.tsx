import { useMemo } from "react";
import BoardRenderer from "./components/BoardRenderer";
import { makeDemoUiState } from "./makeDemoUiState";

export default function App() {
  const { arms, pegPlacements } = useMemo(() => makeDemoUiState(), []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 40,
      }}
    >
      <BoardRenderer arms={arms} pegPlacements={pegPlacements} />
    </div>
  );
}