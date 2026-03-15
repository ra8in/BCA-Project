# NEPSE PAPER TRADING SYSTEM
# NEPSE PAPER TRADING SYSTEM

**Bachelor of Computer Application (BCA)**
Faculty of Humanities and Social Sciences
Texas International College, Mitrapark, Chabahil
Tribhuvan University

*A Project Report Submitted in Partial Fulfillment of the Requirements for the Degree of Bachelor of Computer Application*

---

**Submitted by:**
[Your Full Name] — Roll No: [Your Roll No]
[Partner's Full Name] — Roll No: [Partner's Roll No]

**Submitted to:**
Mr. Sukraj Neyong
Project Supervisor
Texas International College, Mitrapark, Chabahil

**Date:** March 2026

---

## LETTER OF APPROVAL

This is to certify that this project prepared by **[Student Name(s)]** entitled **"NEPSE PAPER TRADING SYSTEM"** in partial fulfillment of the requirements for the degree of Bachelor in Computer Application has been evaluated. In our opinion it is satisfactory in scope and quality as a project for the required degree.

---

**Mr. Sukraj Neyong**
Project Supervisor
Texas International College

---

## TABLE OF CONTENTS

1. [Introduction](#chapter-1-introduction)
2. [Background Study](#chapter-2-background-study)
3. [System Analysis and Design](#chapter-3-system-analysis-and-design)
4. [Implementation and Testing](#chapter-4-implementation-and-testing)
5. [Conclusion and Recommendation](#chapter-5-conclusion-and-recommendation)

---

## CHAPTER 1: INTRODUCTION

### 1.1 Project Background

The Nepal Stock Exchange (NEPSE) is the sole stock exchange in Nepal and plays a crucial role in capital mobilization across the country. In recent years, public interest in stock market trading has grown significantly. However, the high financial risk involved in real trading discourages many first-time investors, students, and general users from participating and learning.

The **NEPSE Paper Trading System** is a full-stack web application that simulates the real NEPSE trading environment. Users are given a virtual balance of Rs. 10,00,000 (one million rupees) and can buy and sell real NEPSE-listed stocks at live market prices without using real money. This allows beginners, students, and enthusiasts to learn stock market dynamics, develop investment strategies, and build financial literacy in a completely risk-free environment.

### 1.2 Problem Statement

The following key problems motivated this project:

- **High Financial Risk for Beginners**: Many people who wish to learn about the stock market cannot afford to risk real capital.
- **Lack of Educational Tools**: No dedicated risk-free simulation platform for NEPSE exists that uses live, real-time data.
- **Complexity of Learning**: Understanding concepts like WACC (Weighted Average Cost of Capital), Capital Gain Tax (CGT), broker commissions, and SEBON fees is difficult without hands-on practice.
- **No Portfolio Tracking**: Beginners have no easy way to track simulated portfolio performance over time.

### 1.3 Objectives

The main objectives of this project are:

1. To develop a web-based paper trading platform with real-time NEPSE market data.
2. To allow users to place Market and Limit buy/sell orders in a simulated environment.
3. To accurately model NEPSE fee structures including broker commissions (0.4%), SEBON fee (0.015%), DP charge (Rs. 25), and Capital Gains Tax (5%).
4. To provide portfolio management features including holdings tracking, realized P&L, and portfolio history.
5. To provide financial calculators (Buy/Sell, Dividend, Averaging, Adjustment) specific to NEPSE.
6. To allow users to manage watchlists of stocks they are interested in.

### 1.4 Scope of the Project

This project covers the following:

- **User Management**: User registration, login, and profile management with a virtual balance.
- **Market Data**: Real-time stock prices, market indices (NEPSE, Sensitive, Float), sectoral sub-indices, top gainers/losers, and market-depth data sourced from the ShareHub Nepal API.
- **Trading**: Market and Limit order placement for buying and selling NEPSE-listed stocks with NEPSE-compliant fee calculations.
- **Portfolio**: Full portfolio summary with current holdings, unrealized P&L, realized P&L, and historical portfolio snapshots.
- **Calculators**: NEPSE-specific financial calculators for buy/sell cost, dividend, bonus adjustment, and averaging.
- **Watchlist**: Ability to create multiple named watchlists and add/remove stocks.

### 1.5 Limitations

- The platform does not support real money transactions.
- The market data source depends on a third-party API (ShareHub Nepal); availability depends on that service.
- Trading is simulated at the Last Traded Price (LTP) and does not model full order-book matching.
- The circuit breaker rule (±10% of previous close) is modeled for limit orders.

---

## CHAPTER 2: BACKGROUND STUDY

### 2.1 Review of Related Systems

Several stock market simulation platforms exist globally:

| Platform | Market | Key Features |
|---|---|---|
| Investopedia Stock Simulator | US (NYSE/NASDAQ) | Virtual portfolio, news integration |
| MarketWatch Virtual Stock Exchange | US | Multiplayer, leaderboard |
| Moneybhai (Moneycontrol) | India (NSE/BSE) | Large user base, Indian market |
| **NEPSE Paper Trading (This Project)** | **Nepal (NEPSE)** | **Real-time NEPSE data, NEPSE-specific fee model, local calculator tools** |

No widely available dedicated paper trading platform for NEPSE with real-time API data and NEPSE-specific fee calculations existed before this project.

### 2.2 Technology Review

#### 2.2.1 Python & Django REST Framework
Python is a high-level, interpreted programming language widely used for web development and data science. Django is a high-level Python web framework that promotes rapid development and clean, pragmatic design. Django REST Framework (DRF) is a powerful toolkit for building Web APIs on top of Django.

**Why Django?**
- Batteries-included: admin panel, ORM, authentication are built-in.
- DRF provides a clean way to build RESTful APIs.
- Python's strong ecosystem is ideal for financial calculations and data manipulation.

#### 2.2.2 React + Vite
React is a JavaScript library maintained by Meta for building interactive user interfaces. Vite is a next-generation front-end build tool offering extremely fast Hot Module Replacement (HMR).

**Why React?**
- Component-based architecture promotes reusability.
- Fast rendering via Virtual DOM.
- Rich ecosystem of charting and UI libraries.

#### 2.2.3 PostgreSQL
PostgreSQL is an advanced, open-source relational database management system known for its robustness, extensibility, and standards compliance.

**Why PostgreSQL?**
- Handles complex relational data (users, stocks, orders, transactions).
- Advanced indexing for fast queries on time-series price history.
- ACID compliance ensures data integrity for financial transactions.

#### 2.2.4 Docker
Docker is a platform for building, running, and shipping applications in containers. A `docker-compose.yml` defines all services (backend, frontend, database) and their dependencies.

**Why Docker?**
- One-command setup: `docker-compose up --build`
- Identical development and production environments
- No manual installation of Python, Node.js, or PostgreSQL required

---

## CHAPTER 3: SYSTEM ANALYSIS AND DESIGN

### 3.1 Feasibility Study

#### i. Technical Feasibility
All technologies used — Python, Django, React, PostgreSQL, and Docker — are freely available, open-source tools with extensive documentation and community support. The ShareHub Nepal API provides the data source. The development team has the required knowledge to implement the system.

#### ii. Operational Feasibility
The system is designed to be user-friendly. Any user with basic internet browsing knowledge can register, log in, and start trading. The application requires no special software installation by the end user — it only requires a web browser.

#### iii. Economic Feasibility
The system uses entirely free and open-source tools. The only potential cost is hosting the application (e.g., on a cloud server), which can be done at minimal cost. For the BCA project demonstration, it runs entirely on a local machine using Docker Desktop.

### 3.2 System Architecture

The system follows a **Client-Server Architecture** with a REST API separating the frontend and backend:

```
[React Frontend (Vite)]  ←→  [Django REST API Backend]  ←→  [PostgreSQL Database]
                                        ↓
                           [ShareHub Nepal / NEPSE API]
                                        ↓
                              [APScheduler (Background Tasks)]
```

- The **Frontend** communicates with the **Backend** exclusively through REST API calls.
- The **Backend** fetches live market data from the **ShareHub Nepal API** and caches it in-memory (Redis-style via Django's cache framework).
- **APScheduler** runs background tasks to periodically update stock prices during market hours (10:15 AM - 3:15 PM, Sunday to Thursday).

### 3.3 Data Flow Diagrams (DFD)

#### Level 0 DFD (Context Diagram)

```
                    ┌─────────────────────────────┐
     User ────────→ │   NEPSE Paper Trading System │ ←────── NEPSE/ShareHub API
      ↑             └─────────────────────────────┘
      └──────────────────── Result/Response ─────────────────┘
```

#### Level 1 DFD

```
         ┌──────────────┐     Place Order      ┌──────────────────┐
  User → │  Auth Module  │ ──────────────────→  │  Trading Module   │
         └──────────────┘                       └──────────────────┘
                │                                         │
          View Portfolio                      Update Holdings & Balance
                ↓                                         ↓
         ┌──────────────┐     Fetch Prices    ┌─────────────────────┐
         │  Portfolio   │ ←────────────────── │  Market Data Module  │ ←── NEPSE API
         │  Module      │                     └─────────────────────┘
         └──────────────┘
```

### 3.4 Entity Relationship (ER) Diagram

The following entities and their relationships are used:

```
[CustomUser]────────< holds >────────[Holding]
     │                                   │
     │         ─ based on ─              │
     │         ↓                         ↓
     └────< placed >────[Order]────────[Stock]
     │         │         ↑               │
     │         │         │           belongs to
     └─────< leads to >──┴           ↓
     │    [Transaction]          [Sector]
     └──────────────>── snapshots ──> [PortfolioSnapshot]
     └──────────────>── watches ──> [WatchlistGroup]──< has >──[WatchlistItem]──>[Stock]
```

**Key Relationships:**
- One `CustomUser` can have many `Holdings`, `Orders`, `Transactions`, `PortfolioSnapshots`, and `WatchlistGroups`.
- One `Order` leads to one `Transaction` upon execution.
- One `Stock` belongs to one `Sector`, and belongs to one `SubIndex` (via sector).
- A `WatchlistGroup` contains many `WatchlistItems`, each pointing to a `Stock`.

### 3.5 Database Schema

#### users_app_customuser (Custom User Table)
| Column | Type | Description |
|---|---|---|
| id | Integer (PK) | Primary key |
| username | VARCHAR | Unique username |
| email | VARCHAR | User email |
| password | VARCHAR | Hashed password |
| virtual_balance | DECIMAL(15,2) | Virtual cash balance (default: Rs. 10,00,000) |

#### stocks_app_stock
| Column | Type | Description |
|---|---|---|
| id | Integer (PK) | Primary key |
| symbol | VARCHAR(20) | Unique NEPSE symbol (e.g., NABIL) |
| name | VARCHAR(255) | Company name |
| sector_id | FK → Sector | Sector of the stock |
| last_price | DECIMAL(10,2) | Last traded price |
| change | DECIMAL(10,2) | Change from previous close |
| change_percent | DECIMAL(10,2) | % change |
| open_price | DECIMAL(10,2) | Today's open |
| high_price | DECIMAL(10,2) | Today's high |
| low_price | DECIMAL(10,2) | Today's low |
| previous_close | DECIMAL(10,2) | Previous day's close |
| total_trade_quantity | BIGINT | Shares traded today |
| is_active | BOOLEAN | Whether the stock is actively traded |

#### trading_app_order
| Column | Type | Description |
|---|---|---|
| id | Integer (PK) | Primary key |
| user_id | FK → CustomUser | Who placed the order |
| stock_id | FK → Stock | Which stock |
| order_type | CHAR(4) | BUY / SELL |
| order_mode | CHAR(6) | MARKET / LIMIT |
| quantity | POSINT | Number of shares |
| price | DECIMAL | Limit price (null for market) |
| status | CHAR(10) | PENDING / EXECUTED / CANCELLED / REJECTED |
| created_at | DATETIME | When it was placed |

#### trading_app_transaction
| Column | Type | Description |
|---|---|---|
| id | Integer (PK) | Primary key |
| user_id | FK → CustomUser | User involved |
| stock_id | FK → Stock | Stock involved |
| order_id | FK → Order | Originating order |
| transaction_type | CHAR(4) | BUY / SELL |
| quantity | POSINT | Shares traded |
| price | DECIMAL(10,2) | Execution price (LTP) |
| total_amount | DECIMAL(15,2) | price × quantity |
| fees | DECIMAL(10,2) | All fees (commission + SEBON + DP + CGT) |
| net_amount | DECIMAL(15,2) | total_amount + fees (buy), total_amount − fees (sell) |
| wacc_at_sell | DECIMAL | WACC at time of sell (for P&L calculation) |
| realized_pl | DECIMAL | Realized profit/loss for sell transactions |

#### portfolio_app_holding
| Column | Type | Description |
|---|---|---|
| id | Integer (PK) | Primary key |
| user_id | FK → CustomUser | Owner |
| stock_id | FK → Stock | Stock held |
| quantity | POSINT | Shares currently held |
| average_buy_price | DECIMAL(10,2) | Weighted Average Cost per share (WACC) |

### 3.6 Use Case Diagram

**Actors:** User, System (APScheduler), NEPSE API

**Use Cases:**
- **User**: Register, Login, View Market Data, Search Stocks, View Stock Detail, View Market Depth, Place Buy/Sell Order (Market/Limit), View Portfolio, View Holdings, View Transaction History, Cancel Order, Manage Watchlist, Use Calculators (Buy/Sell, Dividend, Bonus, Averaging).
- **System**: Automatically update stock prices every 5 minutes during market hours, execute pending limit orders when price is triggered, take portfolio snapshots.
- **NEPSE API**: Provide real-time stock prices, indices, sub-indices, and market depth data.

### 3.7 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login and receive JWT token |
| GET | `/api/stocks/` | List all active stocks |
| GET | `/api/stocks/<symbol>/` | Stock detail with live price |
| GET | `/api/stocks/search/?q=` | Search stocks by symbol/name |
| GET | `/api/stocks/sectors/` | List all sectors |
| GET | `/api/stocks/indices/` | List main market indices (NEPSE, Sensitive, Float) |
| GET | `/api/stocks/sub-indices/` | List sectoral sub-indices |
| GET | `/api/stocks/market-status/` | Get current market open/close status |
| GET | `/api/stocks/top-gainers/` | Top 10 gaining stocks |
| GET | `/api/stocks/top-losers/` | Top 10 losing stocks |
| GET | `/api/stocks/top-turnover/` | Top 10 by total traded value |
| GET | `/api/stocks/live-price/<symbol>/` | Real-time LTP (60s cache) |
| GET | `/api/stocks/market-depth/<symbol>/` | Market depth (buy/sell orders) |
| GET | `/api/stocks/history/<symbol>/` | Historical OHLCV data |
| GET | `/api/portfolio/` | User's full portfolio summary |
| GET | `/api/portfolio/holdings/` | Current holdings list |
| POST | `/api/portfolio/buy/` | Place a buy order |
| POST | `/api/portfolio/sell/` | Place a sell order |
| GET | `/api/portfolio/orders/` | Order history |
| POST | `/api/portfolio/orders/<id>/cancel/` | Cancel a pending order |
| GET | `/api/portfolio/history/` | Portfolio value snapshots |
| GET/POST | `/api/portfolio/watchlists/` | Manage watchlist groups |
| POST | `/api/calculators/buy-sell/` | Buy/Sell cost calculator |
| POST | `/api/calculators/dividend/` | Dividend calculator |
| POST | `/api/calculators/adjustment/` | Bonus/Rights price adjustment calculator |
| POST | `/api/calculators/averaging/` | Share averaging calculator |

---

## CHAPTER 4: IMPLEMENTATION AND TESTING

### 4.1 Implementation

#### 4.1.1 Project Setup & Running

The project is fully Dockerized. The only prerequisite is Docker Desktop.

**Step 1: Clone the repository**
```bash
git clone https://github.com/ra8in/BCA-Project.git
cd BCA_Project
```

**Step 2: Build and start (First time)**
```bash
docker-compose up --build
```

**Step 3: Access the app**
- Frontend: `http://localhost:5173`
- Backend Admin: `http://localhost:8000/admin/` (admin / admin123)

The `docker-compose.yml` defines three services:
| Service | Technology | Port |
|---|---|---|
| `backend` | Django + Gunicorn | 8000 |
| `frontend` | React + Vite | 5173 |
| `db` | PostgreSQL 15 | 5432 |

#### 4.1.2 Backend (Django REST Framework)

The backend is organized into the following Django applications:

| App | Responsibility |
|---|---|
| `users_app` | Custom user model with virtual balance |
| `stocks_app` | Stock, Sector, Index models; Live price services; Market data scheduler |
| `trading_app` | Order and Transaction models |
| `portfolio_app` | Holdings, Watchlist, Portfolio summary, Buy/Sell views |
| `calculators_app` | NEPSE-specific financial calculators |
| `alerts_app` | (Price alert system) |
| `market_data_app` | (Market data aggregation) |

#### 4.1.3 Fee Calculation Logic

When a buy order is executed, fees are calculated as:

| Fee Type | Rate |
|---|---|
| Broker Commission | 0.40% of total amount (min. Rs. 10) |
| SEBON Fee | 0.015% of total amount |
| DP Charge (CDS) | Rs. 25 flat |
| **Total Buy Cost** | Amount + Commission + SEBON + DP |

When a sell order is executed, additional Capital Gains Tax applies:

| Fee Type | Rate |
|---|---|
| Broker Commission | 0.40% of gross amount (min. Rs. 10) |
| SEBON Fee | 0.015% of gross amount |
| DP Charge (CDS) | Rs. 25 flat |
| Capital Gains Tax (CGT) | 5% of profit (if selling price > WACC) |
| **Net Proceeds** | Gross Amount − All Deductions |

#### 4.1.4 Market Hours & Order Execution

```
Market Hours: 11:00 AM – 3:00 PM (Sunday to Thursday)
```

- **Market Orders** execute immediately at the current Last Traded Price (LTP).
- **Limit Orders** are placed as PENDING and automatically executed by the background scheduler when the market price meets the limit condition:
  - **Buy Limit**: Executes when market price ≤ limit price.
  - **Sell Limit**: Executes when market price ≥ limit price.

The background scheduler (APScheduler) runs every 5 minutes during market hours to:
1. Fetch updated prices from the ShareHub Nepal API.
2. Check and execute any pending limit orders.
3. Take portfolio snapshots.

#### 4.1.5 Circuit Breaker Rule

Limit orders must respect NEPSE's circuit breaker: the limit price must be within ±10% of the stock's previous closing price. The system validates this on order submission:

```python
min_price = previous_close * 0.90
max_price = previous_close * 1.10
```

#### 4.1.6 Frontend (React + Vite)

The frontend is built with React and Vite. It communicates with the backend using a proxy configured in `vite.config.js` that points to `http://backend:8000`. This means all API calls from the browser go to the same host, avoiding CORS issues.

Key pages/sections:
- **Dashboard**: Market overview with indices, top gainers, losers, and turnover.
- **Market**: Browse all stocks with live prices.
- **Stock Detail**: OHLCV data, price chart, market depth, trading panel.
- **Portfolio**: Summary card (cash, invested, current value, P&L), holdings table, portfolio history chart.
- **Calculators**: Tab-based calculator panel (Buy/Sell, Dividend, Bonus, Averaging).
- **Watchlist**: Manage watchlist groups and items.

### 4.2 Testing

#### 4.2.1 Unit Testing (Backend)

Backend testing is done using Django's built-in `TestCase` framework.

**Test: Buy Order Execution**
- Create a test user with Rs. 100,000 virtual balance.
- Send a POST request to `/api/portfolio/buy/` with a valid stock symbol and quantity.
- Assert that the user's balance is deducted correctly (including fees).
- Assert a `Holding` record is created with the correct WACC.
- Assert an `Order` record with `status=EXECUTED` is created.
- Assert a `Transaction` record is created with the correct fee breakdown.

**Test: Sell Order Execution**
- Given a user with an existing holding, send a POST to `/api/portfolio/sell/`.
- Assert the user's balance increases by the correct net amount.
- Assert the holding is reduced (or deleted if fully sold).
- Assert the realized P&L in the `Transaction` is computed correctly.

**Test: Insufficient Funds**
- Attempt a buy order that exceeds the user's virtual balance.
- Assert the response is `HTTP 400 Bad Request` with error `"Insufficient funds"`.
- Assert the user's balance is unchanged and no transaction is created.

**Test: Circuit Breaker Validation**
- Place a limit order with a price outside ±10% of previous close.
- Assert the system returns `HTTP 400 Bad Request` with a circuit breaker error message.

**Test: Market Closed**
- Mock the market as "closed" and attempt a buy.
- Assert the response is `HTTP 400 Bad Request` with reason `"Market is closed"`.

#### 4.2.2 Calculator Unit Tests

**Test: Buy Cost Calculation**
- Input: Qty=100, Price=Rs. 500 (Market Buy).
- Expected: Gross = Rs. 50,000. Commission = Rs. 200, SEBON = Rs. 7.5, DP = Rs. 25. Total Cost = Rs. 50,232.5.
- Assert the API returns these exact values (within decimal tolerance).

**Test: Dividend Calculation**
- Input: Qty=100, Bonus=10%, Cash=5%, Face Value=Rs. 100.
- Expected: Bonus Shares=10, Cash Dividend = Rs. 500.
- Assert the API returns correct bonus shares and cash dividend amounts.

#### 4.2.3 Manual Testing (Frontend)

| Test Case | Steps | Expected Result |
|---|---|---|
| User Registration | Fill registration form and submit | User created, redirected to login |
| User Login | Enter credentials | JWT token stored, dashboard loads |
| Stock Search | Type "NABIL" in search bar | NABIL and related stocks appear |
| Buy Stock | Buy 10 shares of NABIL at market | Balance decreases, holding appears |
| Sell Stock | Sell 5 shares of NABIL at market | Balance increases, P&L shown |
| Limit Order (Pending) | Place buy limit well below current price | Order shows as PENDING |
| Cancel Order | Cancel the pending limit order | Order removed, no balance change |
| Watchlist | Add NABIL to "My Watchlist" | NABIL appears in watchlist |
| Calculator | Enter buy/sell data in calculator | Correct fee breakdown shown |

---

## CHAPTER 5: CONCLUSION AND RECOMMENDATION

### 5.1 Conclusion

The **NEPSE Paper Trading System** successfully meets its stated objectives. The system delivers a risk-free, realistic simulation environment for the Nepal Stock Exchange by:

- Integrating live market data from the ShareHub Nepal API.
- Implementing an accurate and complete NEPSE fee model (commission, SEBON, DP, CGT).
- Supporting both Market and Limit order types with a circuit breaker rule.
- Providing a comprehensive portfolio management interface with real-time P&L tracking.
- Offering NEPSE-specific financial calculators to aid investment decision-making.
- Using modern, industry-standard technologies (Django REST Framework, React, Docker) that are directly applicable in professional software development.

The project demonstrates the integration of multiple software engineering concepts: RESTful API design, MVC architecture, relational database modeling, containerization with Docker, asynchronous background tasks, and modern frontend development with React.

### 5.2 Limitations

- The simulated trading experience is not identical to real NEPSE trading, as real order-book matching is not modeled.
- Data availability depends on the third-party ShareHub Nepal API, which may have downtime or data delays.
- The current implementation does not include IPO applications or rights share subscriptions.

### 5.3 Recommendations for Future Work

1. **Real Order-Book Simulation**: Implement a proper order-book where buy and sell limit orders are matched against each other, rather than against the LTP.
2. **Price Alerts**: Complete the `alerts_app` to send email or browser push notifications when a stock hits the user's target price.
3. **Advanced Analytics**: Add portfolio analytics such as Sharpe ratio, beta, and sector allocation charts.
4. **Leaderboard**: Implement a global leaderboard to rank users by portfolio performance, gamifying the learning experience.
5. **IPO Simulation**: Simulate IPO application and allotment processes.
6. **Mobile Application**: Develop a React Native companion app for mobile users.

---

## REFERENCES

1. Django REST Framework Documentation — https://www.django-rest-framework.org/
2. React Official Documentation — https://react.dev/
3. PostgreSQL Documentation — https://www.postgresql.org/docs/
4. Docker Documentation — https://docs.docker.com/
5. NEPSE Official Website — https://www.nepalstock.com.np/
6. ShareHub Nepal API — https://sharehubnepal.com/
7. Securities Board of Nepal (SEBON) — https://www.sebon.gov.np/
8. Sommerville, I. (2016). *Software Engineering* (10th ed.). Pearson Education.

---

*This document was prepared as part of the BCA Final Project — Texas International College, Tribhuvan University, 2026.*
