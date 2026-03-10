import React from "react";
import BoardRenderer from "./components/BoardRenderer";

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 40
      }}
    >
      <BoardRenderer arms={4} />
    </div>
  );
}