import { useState } from "react";
import "./App.css";

import ResponderDashboard from "./responder/ResponderDashboard";
import CitizenDashboard from "./citizen/CitizenDashboard";

function App() {
  const [view, setView] = useState("citizen");

  return (
    <div>
      {/* Role Switch */}
      <div className="role-switch">
        <button
          className={view === "citizen" ? "active-role" : ""}
          onClick={() => setView("citizen")}
        >
          👤 Citizen
        </button>

        <button
          className={view === "responder" ? "active-role" : ""}
          onClick={() => setView("responder")}
        >
          🚑 Responder
        </button>
      </div>

      {/* Current View */}
      {view === "citizen" ? (
        <CitizenDashboard />
      ) : (
        <ResponderDashboard />
      )}
    </div>
  );
}

export default App;