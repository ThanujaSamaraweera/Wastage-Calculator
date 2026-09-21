# Basilur wastage dashboard

A plain HTML, CSS and JavaScript dashboard backed by a read-only Node.js API for your SQL Server ERP. No build step and no third-party frontend/CDN requests.

## Run

Requires Node.js 22+ and network access to the ERP server.

```powershell
npm install
npm start
```

Open http://127.0.0.1:6500. The existing `.env` supplies `ERP_DB_SERVER`, `ERP_DB_DATABASE`, `ERP_DB_USER` and `ERP_DB_PASSWORD`. Keep that file private; it is ignored by Git and is never served by the application. `.env.example` documents configuration without credentials.

The inspected SQL Server rejected modern TLS. `ERP_DB_ENCRYPT=false` was added to the local `.env` after a successful connection with this setting. This means the database connection is not encrypted; use the trusted organization network/VPN. If SQL Server is upgraded to support TLS, set it to `true`. Certificate validation stays enabled unless explicitly overridden.

The server defaults to localhost. There is no application login. Before exposing it to other users, place it behind your organization's authenticated HTTPS proxy; configure HOST/PORT for that deployment.

## Use

- Search item codes or descriptions; filter year, month range, category and site.
- Expand an item with + to see monthly rows; collapse with − or use the global expand/collapse buttons.
- Select a month in the quantities chart to focus the report. Reset restores the complete selected year and clears search/category/site filters.
- Click column headings to sort. Pagination displays 30 materials per page; totals and charts always cover every filtered material.
- Export CSV downloads all filtered materials and their month rows, across every page, regardless of expansion state.
- Refresh bypasses the five-minute data cache. Updates are reflected only after refresh or the next data request after expiry.

## Calculations and source rules

Source: `dbo.matltran_all`. Months come from `trans_date`, using inclusive start and exclusive end date boundaries for the selected year.

- Wastage: reason_code IN W21, W22, W20, W24, W25, B02.
- Issued: all rows with trans_type = I, regardless of work center (wc).
- Quantity for both measures: **-SUM(qty)**. Inspection confirmed negative stock outflows and positive inflows. Signed net quantities preserve reversals and returns; ABS per transaction would inflate usage. A row matching both criteria contributes to both quantities.
- Monthly rate: monthly wastage / monthly issued × 100.
- Cumulative rate: running wastage / running issued × 100, beginning at the selected From month and resetting for each item/year.
- Item and overall totals: total wastage / total issued × 100, never an average of rates.
- A zero or negative issued denominator displays N/A. Months with no matching transactions display zero quantities, N/A monthly rates, and carry forward the cumulative rate when defined.
- Display rounds to two decimals; calculations and CSV retain underlying numeric precision.

Transactions are first aggregated by item, site and month. `dbo.BTE_LOTAging` is reduced to one row per item before joining, so multiple lots never multiply quantities. Description uses MAX of nonblank `itemdescription`; FLV category uses MAX of nonblank `FLVGroup`. If an item has inconsistent descriptions/groups across lots, that deterministic choice is used. No quantity comes from the aging view.

Categories use only FLVGroup from BTE_LOTAging. Missing or blank groups display as Unclassified. The filter, material table and CSV export all use this same source.

The live 2026 verification found 3,314 materials, of which 661 had no available description in the aging view. These remain in the report with `Description unavailable`, preserving their quantities. Complete historical descriptions require a separate authoritative item master source.

Cross-item totals can combine different units of measure because the specified sources do not provide a transaction unit field. Filter to comparable materials before interpreting aggregate quantities/rates.

## Verification

```powershell
npm test
# With npm start running in another terminal:
node scripts/browser-test.js
node --env-file=.env scripts/verify-live.js
# Read-only schema inspection:
npm run inspect-db
```

The browser checks use installed Microsoft Edge through Playwright. Screenshots are saved under ignored `test-results/`. Checks cover live data, drill-down/up, filtering, ranges, CSV download, empty/error states, chart interaction, mobile overflow, denied access to private files, and invalid requests. Independent live SQL sums reconcile against the API, checking that the view join does not duplicate records. No database writes or schema changes are performed.

SQL client: https://tediousjs.github.io/node-mssql/

## Files

- `server.js`: HTTP server, allowlisted static files and API routes.
- `db.js`: server-only connection configuration and pool.
- `repository.js`: parameterized, read-only SQL and bounded cache.
- `public/report.js`: testable filtering, grouping and percentage calculations.
- `public/index.html`, `styles.css`, `app.js`: interface, charts and CSV export.
- `tests/report.test.js`: calculation regression tests, including the supplied January–March example.

## Interface shortcuts

Quarter and year-to-date buttons change the month range. Year to date is available for the current year. Remove individual filters with their chips or use Clear filters. Press `/` outside an input to focus material search. Click an FLV group in the table to filter it. Click an item code for a modal showing that item's totals, monthly quantities and wastage profile; Escape closes it. Compact rows and the rows-per-page control change table density. Hover or keyboard-focus chart months to see exact quantities and rates. CSV export shows a completion message.

Run `node scripts/interface-test.js` with the local server running to check these interactions with controlled browser fixtures. The standard browser checks continue to use live ERP data.

The transparent Basilur asset is `public/assets/basilur-transparent.png`. The original JPG is retained. The built-in image generation/editing tool was used for background extraction; see `public/assets/basilur-edit-prompt.txt` for the exact prompt. The generated PNG contains true alpha transparency.
