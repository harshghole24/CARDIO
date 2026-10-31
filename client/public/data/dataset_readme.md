# India Credit Card Rewards Dataset (snapshot: 7 Oct 2026)

Built from published sources only. Every row carries a source URL and a confidence flag. Nothing was invented;
where a source gives only a range, the row says so (`VARIES_BY_CARD`) instead of guessing a ratio.

## Files
| File | Rows | What it is |
|---|---|---|
| credit_cards.csv | 280 | Fees, waiver spend, forex, base/max reward rate, reward currency, point value (paise), derived points per Rs 100 |
| reward_currencies.csv | 28 | Reward currencies (HDFC RP, Axis EDGE Miles, Amex MR, ...) |
| loyalty_programs.csv | 37 | Airline + hotel programs incl. Maharaja Club, KrisFlyer, Lotusmiles, Flying Blue, Avios programs, Virgin, Accor, Bonvoy, Hilton... with India status notes |
| transfer_routes_currency_level.csv | 97 | Currency -> program routes with minimums, caps, transfer time, source tier |
| card_program_ratios.csv | 446 | **Per-card exact ratio** (points_in -> points_out) per program: this drives the conversion calculator |
| award_chart.csv | 73 | Real redemption prices (Maharaja Club, KrisFlyer, Virgin Atlantic, Lotusmiles) by route and cabin |
| airports.csv | 96 | 46 Indian + 50 international airports with IATA, city, country, lat/lon |
| movies_dining_benefits.csv | 9 | Starter set of verified movie/dining benefits (see gaps) |

## Core formulas (all inputs are in the CSVs)
- points earned = spend_inr / 100 * `base_points_per_100_inr_derived` (use `max_...` for bonus categories)
- program miles = points * `points_out` / `points_in` (card_program_ratios.csv)
- spend needed for a flight = points_required (award_chart.csv) / (points_out/points_in) / (points_per_100/100)
- Respect `min_transfer` (round up) and `annual_cap`.

Worked, verifiable examples
- Axis Atlas (2 EDGE Miles/Rs100; 1:2 to Maharaja Club): Rs 1,60,000 -> 3,200 EM -> 6,400 Maharaja Points.
  Mumbai-Goa economy = 3,000 points -> 1,500 EM -> Rs 75,000 spend.
- HDFC Infinia (~3.3 RP/Rs100; 2:1 to Maharaja Club): Rs 1,60,000 -> ~5,280 RP -> ~2,640 Maharaja Points.
- Atlas to KrisFlyer 1:2: Mumbai-Singapore economy Saver 19,000 miles -> 9,500 EM -> Rs 4,75,000 spend.

## Confidence values
- `EXPLICIT_SOURCE`: ratio stated for that card/currency in the cited source.
- `INFERRED_STANDARD_TIER`: Axis partner not individually named in sources; Axis states most partners use the standard tier ratio, so that tier is applied. Verify in the Axis portal.
- `INFERRED_ELIGIBILITY`: currency-level ratio is published but per-card eligibility is not itemised.
- `SOURCE_UNVERIFIED_BY_PUBLISHER`: the aggregator marks the route as unverified (e.g. Amex-Marriott).

## Key facts and recent changes captured (as of the cited dates)
- Club Vistara no longer exists (merged into Air India). Maharaja Club is the Air India program; award chart repriced 1 Apr 2026.
- Axis (Sept 2026): Air India, Flying Blue, Qantas moved to Group A (caps: Atlas 30,000 EDGE Miles/yr; Magnus/Reserve 1,00,000 pts/yr). Marriott still removed; ITC off the list; Qatar and Accor back at reduced ratios; Cathay, Hilton, Miles & More added.
- Amex India (18 Aug 2026): Virgin 5:4, Hilton 2:3 may be an unlabelled bonus. Emirates suspended since 28 May 2025, Etihad dropped 1 Jul 2026.
- Lotusmiles: LotusDay 50% off award tickets until 31 Oct 2026 (promo prices only in file).
- Axis Atlas is closed to new applicants per CardAdvisor; keep it in the catalogue for existing holders.

## Known gaps (not yet researched; flagged so the app can show "unverified")
- Award charts for Flying Blue, Avios (BA/Qatar/Finnair), Asia Miles, IndiGo BluChip, Accor/Bonvoy/Hilton nights: not in file.
- India-city KrisFlyer prices other than AMD/BLR are inferred from the single South Asia zone (flagged MEDIUM).
- Maharaja Club prices are the lowest fare level; higher fare levels cost more. Some domestic Business rows are MEDIUM (cabin inferred).
- Movies/dining: only 9 verified benefits. Lounge entitlements (170 cards), merchant offers (Zomato, Swiggy, Amazon, Flipkart) are NOT included; import cardadvisor.in/data/lounges.csv (CC BY 4.0) for lounges.
- Per-card ratios for IndusInd, YES, RBL, Federal, ICICI (non-premium) exist only as ranges at currency level.
- Airports: IATA/name/city are standard reference data; coordinates are rounded to 2 decimals. Cross-check against OurAirports (public domain) before launch.

## Sources and licences
- CardAdvisor India open dataset v. 2026-10-01 (cards, valuations, transfers): https://cardadvisor.in/data , CC BY 4.0, attribution required.
- Magnify: Maharaja Club transfers (23 Sep 2026), Axis changes (23 Sep 2026), Amex India partners (18 Aug 2026), Maharaja award chart (Apr 2026).
- Air India press release, 1 Apr 2026; Aviation A2Z, 2 Apr 2026.
- KrisFlyer: mainlymiles.com (Apr 2026), awardtravelfinder.com (Jul-Sep 2026), CardAdvisor KrisFlyer guide (Jul 2026).
- Bank/airline T&C pages are linked per row in `source_url`.
- Always show a disclaimer: ratios and award prices change without notice; confirm on the bank and airline site before transferring.
