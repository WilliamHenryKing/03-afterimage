import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles.css";

// The App mounts the three.js stage; the arrival veil lifts after its first rendered frame.
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
