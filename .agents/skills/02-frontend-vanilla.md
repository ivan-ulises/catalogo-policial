[SKILL 2: VANILLA FRONTEND & RESILIENCE ARCHITECTURE]
Context: The frontend is a lightweight, static architecture designed for users in municipal governments or field operations who may have unstable 3G connections.

Architecture & Constraints:
1. Framework-less UI: Do NOT use or suggest React, Vue, Next.js, Webpack, or Vite. All UI state management and DOM manipulation must be executed strictly with Vanilla JavaScript (ES6+).
2. Styling Protocol: The project uses Tailwind CSS exclusively via CDN. There is no build step or `tailwind.config.js`. Do not suggest `npm install`. All styling modifications must be done using standard Tailwind utility classes directly within the HTML elements.
3. Resilience Pattern (The WhatsApp Fallback): The most critical business rule is that the client must always reach WhatsApp. Order submission relies on a strict dual-track mechanism. When the user clicks to finalize the order, a `fetch` POST request is sent to the backend, and a 2000ms (2-second) `setTimeout` is triggered simultaneously.
4. STRICT RULE: If the backend `fetch` takes longer than 2 seconds, hangs, or returns a CORS/500 error, the UI MUST forcefully clear the state and redirect the user to the WhatsApp API (`wa.me`) using `window.location.href`. Never block the user's screen indefinitely waiting for a backend confirmation.