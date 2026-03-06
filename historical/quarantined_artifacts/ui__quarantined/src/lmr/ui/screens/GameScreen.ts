import React from "react";
import { UiModel } from "../uiState.js";

type Props = {
  model: UiModel;
};

export function GameScreen({ model }: Props) {
  const turn = model.game.turn;
  const interaction = model.turnInteraction;

  const isMyTurn = model.localActorId === turn.nextActorId;

  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      <h2>Game</h2>

      {/* =========================
          TURN STATE PANEL (UI-1)
         ========================= */}

      <div
        style={{
          border: "1px solid #888",
          padding: 12,
          marginBottom: 16,
          background: "#f5f5f5",
        }}
      >
        <div>
          <strong>Next Actor:</strong>{" "}
          {turn.nextActorId ?? "(none)"}{" "}
          {isMyTurn ? "← YOU" : ""}
        </div>

        <div>
          <strong>Awaiting Dice:</strong>{" "}
          {turn.awaitingDice ? "true" : "false"}
        </div>

        <div>
          <strong>Selected Dice:</strong>{" "}
          {interaction.selectedDice
            ? interaction.selectedDice.join(", ")
            : "(none)"}
        </div>

        <div>
          <strong>Legal Moves:</strong>{" "}
          {interaction.legalMoves
            ? interaction.legalMoves.length
            : 0}
        </div>

        <div>
          <strong>Last Error:</strong>{" "}
          {interaction.lastError
            ? `${interaction.lastError.code}: ${interaction.lastError.message}`
            : "(none)"}
        </div>
      </div>

      {/* =========================
          RAW STATE (temporary)
         ========================= */}

      <div>
        <h3>State Hash</h3>
        <div>{model.game.stateHash ?? "(none)"}</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Raw Game State</h3>
        <pre style={{ maxHeight: 300, overflow: "auto" }}>
          {JSON.stringify(model.game.gameState, null, 2)}
        </pre>
      </div>
    </div>
  );
}