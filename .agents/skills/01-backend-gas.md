[SKILL 1: SERVERLESS GOOGLE APPS SCRIPT (GAS) BACKEND]
Context: The backend for this project is strictly built on Google Apps Script (GAS). It acts as a lightweight, serverless REST API (via `doPost`) to process B2B order payloads from the frontend.

Architecture & Constraints:
1. No traditional servers (Node.js, Python) or databases (PostgreSQL, MongoDB) are used. The database is exclusively Google Sheets.
2. The backend logic handles three main tasks: appending order data to a specific Sheet, dynamically generating a two-page PDF (Customer Quote + Supplier Requisition) using GAS `HtmlService`, and triggering automated emails via `MailApp`/`GmailApp`.
3. The frontend and backend are completely decoupled. The frontend communicates with the GAS Web App endpoint (`/exec`) using standard `fetch`.
4. STRICT RULE: Do NOT suggest external backend frameworks, alternative databases, or Node.js libraries (like Puppeteer for PDFs or Nodemailer for emails). All backend solutions, modifications, and error handling must rely entirely on native Google Workspace services and standard JavaScript (ES6) supported by GAS.