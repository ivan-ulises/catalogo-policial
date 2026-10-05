[SKILL 3: DATA FETCHING & HEADLESS CMS (GOOGLE SHEETS)]
Context: The application uses Google Sheets as a Headless CMS to manage the B2B product catalog (inventory, SKUs, pricing, and Cloudinary image URLs). This architecture allows non-technical municipal administrators to update the store in real-time without touching the codebase.

Architecture & Constraints:
1. Zero-Infrastructure Database: Do NOT use or suggest external databases like PostgreSQL, MySQL, MongoDB, Firebase, or Supabase. The single source of truth for the catalog data is exclusively a published Google Sheet.
2. Data Retrieval: Product data is fetched on the client side directly from a public Google Sheets CSV export URL (`pub?output=csv`) using the native `fetch` API (GET request).
3. Parsing & Rendering: The incoming CSV text is parsed natively in the browser using Vanilla JS. The resulting array of objects is then dynamically mapped to HTML template literals to render the product grid in the DOM.
4. STRICT RULE: Keep the data fetching and parsing layer strictly lightweight. Do not introduce ORMs (like Prisma or Drizzle), data-fetching hooks (like SWR or React Query), or heavy parsing libraries unless absolutely necessary. Any modifications to the product rendering logic must manipulate the DOM directly based on the parsed CSV array.