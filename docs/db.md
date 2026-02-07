# RESTRUCTURED & CLARIFIED DATABASE SCHEMA

Let me reorganize everything in a clearer, more digestible way.

---

## 🎯 CORE CONCEPT

Your database has **TWO types of tables**:

1. **🔒 PRIVATE DATA** - Different for each user (has `user_id`)
2. **🌐 PUBLIC DATA** - Same for all users (no `user_id`)

---

# 📊 COMPLETE DATABASE STRUCTURE

---

## 1️⃣ USER ACCOUNT TABLE

### **`users_customuser`** 🔒 PRIVATE

**Purpose:** Store user accounts

```
┌────┬──────────────┬───────────────────────┬──────────────────┬────────────┬─────────────────────┐
│ id │ username     │ email                 │ virtual_balance  │ is_active  │ created_at          │
├────┼──────────────┼───────────────────────┼──────────────────┼────────────┼─────────────────────┤
│ 1  │ rabin_katel  │ rabin@example.com     │ 875,450.50       │ True       │ 2024-11-15 10:30:00 │
│ 2  │ kritika_g    │ kritika@example.com   │ 920,300.00       │ True       │ 2024-11-16 14:20:00 │
└────┴──────────────┴───────────────────────┴──────────────────┴────────────┴─────────────────────┘
```

**Fields:**
- `id` - Unique user identifier
- `username` - Login name
- `email` - Email address
- `virtual_balance` - Current cash available for trading
- `is_active` - Account active/suspended
- `created_at` - When account was created

**One record per user**

---

## 2️⃣ STOCK INFORMATION TABLES (Shared by all users)

### **`stocks_sector`** 🌐 PUBLIC

**Purpose:** Categories of stocks

```
┌────┬───────────────────┬─────────────────────────────────┐
│ id │ name              │ description                     │
├────┼───────────────────┼─────────────────────────────────┤
│ 1  │ Commercial Banks  │ Banking and financial services  │
│ 2  │ Hydro Power       │ Hydroelectric power generation  │
│ 3  │ Hotels & Tourism  │ Hospitality industry            │
└────┴───────────────────┴─────────────────────────────────┘
```

---

### **`stocks_stock`** 🌐 PUBLIC

**Purpose:** Company information (same for all users)

```
┌────┬────────┬─────────────────────────┬───────────┬─────────────┬────────────────┐
│ id │ symbol │ name                    │ sector_id │ market_cap  │ listed_shares  │
├────┼────────┼─────────────────────────┼───────────┼─────────────┼────────────────┤
│ 23 │ NABIL  │ Nabil Bank Limited      │ 1         │ 45,000,000  │ 42,500,000     │
│ 45 │ NICA   │ NIC Asia Bank           │ 1         │ 38,500,000  │ 36,200,000     │
│ 67 │ UPPER  │ Upper Tamakoshi Hydro   │ 2         │ 125,000,000 │ 50,000,000     │
│ 89 │ SOALTEE│ Soaltee Hotel Limited   │ 3         │ 8,500,000   │ 12,000,000     │
└────┴────────┴─────────────────────────┴───────────┴─────────────┴────────────────┘
```

**Relationship:** `sector_id` → links to `stocks_sector.id`

---

### **`stocks_stockprice`** 🌐 PUBLIC (TimescaleDB)

**Purpose:** Historical price data (minute-by-minute)

```
┌─────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────┐
│ timestamp           │ stock_id │ open     │ high     │ low      │ close    │ volume │
├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│ 2025-01-10 11:01:00 │ 23       │ 1,045.00 │ 1,055.00 │ 1,042.00 │ 1,050.00 │ 15,230 │
│ 2025-01-10 11:02:00 │ 23       │ 1,050.00 │ 1,052.00 │ 1,048.00 │ 1,051.00 │ 8,450  │
│ 2025-01-10 11:01:00 │ 45       │ 428.00   │ 430.00   │ 427.00   │ 429.00   │ 25,670 │
└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────┘
```

**Relationship:** `stock_id` → links to `stocks_stock.id`

**Updated:** Every 1 minute during market hours by Celery task

---

### **`stocks_marketindex`** 🌐 PUBLIC (TimescaleDB)

**Purpose:** NEPSE index values over time

```
┌─────────────────────┬───────────┬──────────┬────────┬────────────────┐
│ timestamp           │ index_name│ value    │ change │ change_percent │
├─────────────────────┼───────────┼──────────┼────────┼────────────────┤
│ 2025-01-10 11:01:00 │ NEPSE     │ 2,645.30 │ +12.50 │ 0.47           │
│ 2025-01-10 11:01:00 │ SENSITIVE │ 485.20   │ +2.30  │ 0.48           │
└─────────────────────┴───────────┴──────────┴────────┴────────────────┘
```

---

## 3️⃣ TRADING TABLES (Private - Each user has their own)

### **`trading_order`** 🔒 PRIVATE

**Purpose:** All buy/sell orders placed by users

```
┌────┬─────────┬──────────┬────────────┬──────────┬───────────┬──────────┬─────────────────────┐
│ id │ user_id │ stock_id │ order_type │ quantity │ price     │ status   │ created_at          │
├────┼─────────┼──────────┼────────────┼──────────┼───────────┼──────────┼─────────────────────┤
│ 1  │ 1       │ 23       │ BUY        │ 30       │ 1,000.00  │ EXECUTED │ 2025-01-05 11:20:00 │
│ 2  │ 1       │ 23       │ BUY        │ 20       │ 1,015.00  │ EXECUTED │ 2025-01-05 14:25:00 │
│ 3  │ 2       │ 45       │ BUY        │ 50       │ 428.00    │ EXECUTED │ 2025-01-06 10:30:00 │
│ 4  │ 1       │ 23       │ SELL       │ 10       │ 1,050.00  │ CANCELLED│ 2025-01-08 15:30:00 │
│ 5  │ 2       │ 23       │ BUY        │ 100      │ 995.00    │ PENDING  │ 2025-01-10 09:45:00 │
└────┴─────────┴──────────┴────────────┴──────────┴───────────┴──────────┴─────────────────────┘
```

**Relationships:**
- `user_id` → `users_customuser.id` (which user placed this order)
- `stock_id` → `stocks_stock.id` (which stock)

**Status values:**
- `PENDING` - Not executed yet
- `EXECUTED` - Successfully completed
- `CANCELLED` - User cancelled or failed

---

### **`trading_transaction`** 🔒 PRIVATE

**Purpose:** Detailed breakdown of executed orders (fees, commissions)

```
┌────┬──────────┬─────────────────┬──────────┬──────────────┬──────────────────┬───────────┬────────┬──────────────┬─────────────────────┐
│ id │ order_id │ execution_price │ quantity │ gross_amount │ broker_commission│ sebon_fee │ dp_fee │ total_fees   │ executed_at         │
├────┼──────────┼─────────────────┼──────────┼──────────────┼──────────────────┼───────────┼────────┼──────────────┼─────────────────────┤
│ 1  │ 1        │ 1,000.00        │ 30       │ 30,000.00    │ 120.00           │ 4.50      │ 25.00  │ 149.50       │ 2025-01-05 11:20:15 │
│ 2  │ 2        │ 1,015.00        │ 20       │ 20,300.00    │ 81.20            │ 3.05      │ 25.00  │ 109.25       │ 2025-01-05 14:25:30 │
│ 3  │ 3        │ 428.00          │ 50       │ 21,400.00    │ 85.60            │ 3.21      │ 25.00  │ 113.81       │ 2025-01-06 10:30:20 │
└────┴──────────┴─────────────────┴──────────┴──────────────┴──────────────────┴───────────┴────────┴──────────────┴─────────────────────┘
```

**Relationship:** `order_id` → `trading_order.id` (one-to-one)

**Only EXECUTED orders have transactions** - no transaction for PENDING or CANCELLED orders

**Fee calculation:**
- `broker_commission` = gross_amount × 0.004 (0.4%)
- `sebon_fee` = gross_amount × 0.00015 (0.015%)
- `dp_fee` = Rs. 25 (fixed)
- `total_fees` = sum of all fees

---

## 4️⃣ PORTFOLIO TABLES (Private - Each user has their own)

### **`portfolio_holding`** 🔒 PRIVATE

**Purpose:** Current stocks owned by each user

```
┌────┬─────────┬──────────┬──────────┬───────────────────┬─────────────────┬─────────────────────┐
│ id │ user_id │ stock_id │ quantity │ average_buy_price │ total_invested  │ last_updated        │
├────┼─────────┼──────────┼──────────┼───────────────────┼─────────────────┼─────────────────────┤
│ 1  │ 1       │ 23       │ 50       │ 1,006.65          │ 50,332.50       │ 2025-01-05 14:25:30 │
│ 2  │ 1       │ 45       │ 100      │ 425.20            │ 42,520.00       │ 2025-01-08 11:10:00 │
│ 3  │ 2       │ 23       │ 80       │ 995.30            │ 79,624.00       │ 2025-01-06 15:30:00 │
│ 4  │ 2       │ 45       │ 50       │ 428.27            │ 21,413.81       │ 2025-01-06 10:30:20 │
└────┴─────────┴──────────┴──────────┴───────────────────┴─────────────────┴─────────────────────┘
```

**Relationships:**
- `user_id` → `users_customuser.id` (which user owns this)
- `stock_id` → `stocks_stock.id` (which stock)

**Key Field: `average_buy_price` (WACC)**
- Weighted Average Cost including commissions
- Recalculated on every BUY transaction
- Never changes on SELL (only quantity reduces)

**Example calculation:**
```
User already has: 30 shares @ 1,000 avg = 30,000 invested
User buys more: 20 shares @ 1,015 (with 109.25 fees) = 20,409.25 invested
New total: 50 shares, 50,409.25 invested
New WACC: 50,409.25 ÷ 50 = 1,008.19 per share
```

**UNIQUE constraint:** One row per (user_id, stock_id) combination

---

### **`portfolio_portfoliosnapshot`** 🔒 PRIVATE (TimescaleDB)

**Purpose:** Daily portfolio value history for charts

```
┌─────────────────────┬─────────┬──────────────────────┬───────────────┬───────────────────────┬─────────────────┬──────────────────┐
│ timestamp           │ user_id │ total_holdings_value │ cash_balance  │ total_portfolio_value │ total_invested  │ unrealized_pl    │
├─────────────────────┼─────────┼──────────────────────┼───────────────┼───────────────────────┼─────────────────┼──────────────────┤
│ 2025-01-05 15:00:00 │ 1       │ 50,500.00            │ 949,500.00    │ 1,000,000.00          │ 50,332.50       │ 167.50           │
│ 2025-01-06 15:00:00 │ 1       │ 93,200.00            │ 906,798.00    │ 999,998.00            │ 92,852.50       │ 347.50           │
│ 2025-01-10 15:00:00 │ 1       │ 169,800.00           │ 875,450.50    │ 1,045,250.50          │ 165,112.50      │ 4,687.50         │
│ 2025-01-10 15:00:00 │ 2       │ 130,450.00           │ 878,886.19    │ 1,009,336.19          │ 101,037.81      │ 29,412.19        │
└─────────────────────┴─────────┴──────────────────────┴───────────────┴───────────────────────┴─────────────────┴──────────────────┘
```

**Relationships:** `user_id` → `users_customuser.id`

**Created:** Celery task runs daily at market close

**Used for:** Portfolio performance line charts

**Calculation:**
```
total_holdings_value = sum of (quantity × current_price) for all holdings
cash_balance = user's virtual_balance
total_portfolio_value = holdings + cash
unrealized_pl = total_holdings_value - total_invested
```

---

## 5️⃣ ALERTS TABLES (Private - Each user has their own)

### **`alerts_pricealert`** 🔒 PRIVATE

**Purpose:** Price alerts set by users

```
┌────┬─────────┬──────────┬──────────────┬────────────┬───────────┬──────────────┬─────────────────────┐
│ id │ user_id │ stock_id │ target_price │ alert_type │ is_active │ triggered_at │ created_at          │
├────┼─────────┼──────────┼──────────────┼────────────┼───────────┼──────────────┼─────────────────────┤
│ 1  │ 1       │ 23       │ 1,100.00     │ ABOVE      │ False     │ 2025-01-07   │ 2025-01-05 16:00:00 │
│ 2  │ 1       │ 45       │ 400.00       │ BELOW      │ True      │ NULL         │ 2025-01-08 12:00:00 │
│ 3  │ 2       │ 67       │ 3,000.00     │ ABOVE      │ True      │ NULL         │ 2025-01-09 17:30:00 │
└────┴─────────┴──────────┴──────────────┴────────────┴───────────┴──────────────┴─────────────────────┘
```

**Relationships:**
- `user_id` → `users_customuser.id`
- `stock_id` → `stocks_stock.id`

**Alert Types:**
- `ABOVE` - Notify when price goes above target
- `BELOW` - Notify when price goes below target

**Lifecycle:**
1. User creates alert → `is_active = True`, `triggered_at = NULL`
2. Celery checks every minute
3. When condition met → `is_active = False`, `triggered_at = now()`, create notification

---

### **`alerts_notification`** 🔒 PRIVATE

**Purpose:** Notifications shown to users

```
┌────┬─────────┬────────────────────────────────────────┬────────┬─────────┬─────────────────────┐
│ id │ user_id │ message                                │ type   │ is_read │ created_at          │
├────┼─────────┼────────────────────────────────────────┼────────┼─────────┼─────────────────────┤
│ 1  │ 1       │ Price alert: NABIL reached 1,100       │ ALERT  │ True    │ 2025-01-07 13:45:00 │
│ 2  │ 1       │ Your buy order for NICA was executed   │ ORDER  │ True    │ 2025-01-08 11:10:15 │
│ 3  │ 1       │ Market opens in 15 minutes             │ SYSTEM │ False   │ 2025-01-10 10:45:00 │
│ 4  │ 2       │ Your buy order for NABIL was executed  │ ORDER  │ True    │ 2025-01-06 15:30:20 │
└────┴─────────┴────────────────────────────────────────┴────────┴─────────┴─────────────────────┘
```

**Relationship:** `user_id` → `users_customuser.id`

**Notification Types:**
- `ALERT` - From price alerts
- `ORDER` - Order execution status
- `SYSTEM` - Platform announcements

---

## 6️⃣ MARKET DATA TABLES (Background tasks)

### **`market_data_datafetchlog`** 🌐 PUBLIC

**Purpose:** Track data fetching from ShareHub Nepal

```
┌────┬─────────────────────┬─────────────┬─────────┬─────────────────┬──────────┐
│ id │ timestamp           │ source      │ status  │ records_updated │ error    │
├────┼─────────────────────┼─────────────┼─────────┼─────────────────┼──────────┤
│ 1  │ 2025-01-10 11:01:00 │ ShareHub    │ SUCCESS │ 245             │ NULL     │
│ 2  │ 2025-01-10 11:02:00 │ ShareHub    │ SUCCESS │ 245             │ NULL     │
│ 3  │ 2025-01-10 11:03:00 │ ShareHub    │ FAILED  │ 0               │ Timeout  │
└────┴─────────────────────┴─────────────┴─────────┴─────────────────┴──────────┘
```

**Purpose:** Monitor health of data fetching

---

### **`market_data_marketstatus`** 🌐 PUBLIC

**Purpose:** Current market status

```
┌────┬─────────┬──────────────────┬─────────────────────┐
│ id │ is_open │ current_session  │ last_updated        │
├────┼─────────┼──────────────────┼─────────────────────┤
│ 1  │ True    │ TRADING          │ 2025-01-10 11:30:00 │
└────┴─────────┴──────────────────┴─────────────────────┘
```

**Sessions:** PRE_OPEN, TRADING, POST_CLOSE, CLOSED

**Trading hours:** Sunday-Friday, 11:00 AM - 3:00 PM

---

# 📋 COMPLETE TABLE SUMMARY

## 🔒 PRIVATE TABLES (User-specific data)

| Table | Purpose | Key Field |
|-------|---------|-----------|
| `users_customuser` | User accounts | `id` (user identifier) |
| `trading_order` | Buy/sell orders | `user_id` (which user) |
| `trading_transaction` | Order fee breakdown | `order_id` (which order) |
| `portfolio_holding` | Current stock ownership | `user_id`, `stock_id` |
| `portfolio_portfoliosnapshot` | Historical portfolio value | `user_id`, `timestamp` |
| `alerts_pricealert` | Price alerts | `user_id`, `stock_id` |
| `alerts_notification` | User notifications | `user_id` |

## 🌐 PUBLIC TABLES (Shared by all users)

| Table | Purpose | Updated By |
|-------|---------|------------|
| `stocks_sector` | Stock categories | Manual/Admin |
| `stocks_stock` | Company information | Manual/Admin |
| `stocks_stockprice` | Historical prices | Celery (every 1 min) |
| `stocks_marketindex` | NEPSE index values | Celery (every 1 min) |
| `market_data_datafetchlog` | Fetch monitoring | Celery |
| `market_data_marketstatus` | Market open/closed | Celery |

---

# 🔗 KEY RELATIONSHIPS

```
users_customuser (1) ─────< (many) portfolio_holding
users_customuser (1) ─────< (many) trading_order
users_customuser (1) ─────< (many) alerts_pricealert
users_customuser (1) ─────< (many) alerts_notification
users_customuser (1) ─────< (many) portfolio_portfoliosnapshot

trading_order (1) ────── (1) trading_transaction

stocks_stock (1) ─────< (many) portfolio_holding
stocks_stock (1) ─────< (many) trading_order
stocks_stock (1) ─────< (many) alerts_pricealert
stocks_stock (1) ─────< (many) stocks_stockprice

stocks_sector (1) ─────< (many) stocks_stock
```

**Legend:**
- `(1) ─────< (many)` = One-to-Many relationship
- `(1) ────── (1)` = One-to-One relationship

---

# ✅ FINAL CLARITY

**Is this clear now?**

- ✅ Tables with `user_id` = Each user has separate data
- ✅ Tables without `user_id` = Shared by all users
- ✅ Foreign keys connect related data
- ✅ Django automatically filters by logged-in user
- ✅ Can handle unlimited users

**This schema is production-ready!** 🚀