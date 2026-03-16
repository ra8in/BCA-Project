# Fix Data Discrepancy in Backend Cache

## Problem Description
The frontend is showing inconsistent data compared to the backend database, specifically for the `previous_close` field and subsequent percentage change calculations. 

**Root Cause:**
In [backend/stocks_app/services.py](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py), the [_refresh_global_stock_cache()](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py#589-871) function has complex logic to reconstruct `previous_close` from the [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) history tables instead of just reading the `previous_close` column from the [Stock](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#57-67) table. 

1. **Phase 1 (Market Closed fallback):** It tries to fetch the 2nd most recent [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) using an unreliable grouping logic that fails to correctly map the previous close, often defaulting to old, incorrect values (e.g., 495.9 instead of 530.5 for NABIL).
2. **Phase 2 (Market Open fetch):** It fetches the absolute latest [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) close value using `Max('timestamp')` and uses that as `previous_close`. However, the [create_end_of_day_stock_prices()](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py#1248-1320) script updates `Stock.previous_close` directly, meaning the true `previous_close` is safely stored on the [Stock](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#57-67) model itself. By bypassing the `Stock.previous_close` field during cache rebuilds, the server caches stale history data.

## Proposed Changes

### 1. [backend/stocks_app/services.py](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py)
Simplify [_refresh_global_stock_cache()](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py#589-871). Since the daily EOD job ([create_end_of_day_stock_prices](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py#1248-1320)) already updates the `Stock.previous_close` field correctly, we should use that field directly instead of querying the [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) history table.

#### [MODIFY] [backend/stocks_app/services.py](file:///c:/Users/RABIN/Downloads/BCA-Project/backend/stocks_app/services.py)
- **In Phase 1 (Market Closed):** Remove the complex [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) querying logic. Simply iterate through `db_stocks` and use `stock.previous_close`.
- **In Phase 2 (Market Open):** Remove the [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) query that builds `prev_close_map`. Instead, read `previous_close` from a dictionary built directly from the active [Stock](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#57-67) objects.
- **In Phase 3 (DB Fallback):** Similar to Phase 1, remove the [StockPrice](file:///c:/Users/RABIN/Downloads/BCA-Project/frontend/src/services/stockService.js#27-41) history querying and rely natively on `stock.previous_close`.

## Verification Plan

### Automated Tests
1. Clear the redis cache.
2. Trigger the cache refresh manually via Django shell (`from stocks_app.services import _refresh_global_stock_cache; _refresh_global_stock_cache()`).
3. Verify that `cache.get('stock_price:NABIL')['previous_close']` correctly matches `Stock.objects.get(symbol='NABIL').previous_close`.

### Manual Verification
1. User can open the frontend URL and verify that the stock prices, specifically "Previous Close", "Change", and "Change %", align perfectly with the backend database.
