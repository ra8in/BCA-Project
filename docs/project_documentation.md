# NEPSE PAPER TRADING SYSTEM

**Tribhuvan University**
Faculty of Humanities and Social Sciences

**A Final Year Project Report**
On
**"NEPSE PAPER TRADING SYSTEM"**

Submitted to:
Department of Computer Application
**AMBITION COLLEGE**
Mid-Baneshwor, Kathmandu

In partial fulfillment of the requirements for the Bachelor in Computer Application

---

**Submitted By:**
Rabin Katel [Reg No.: 6-2-1058-60-2023]
Kritika Ghimire [Reg. No.: 6-2-1058-70-2023]

**Under the Supervision of:**
Mr. Sarad Raj Bhandari

**November, 2025**

---

## LETTER OF APPROVAL

This is to certify that this project report prepared by **Rabin Katel** (Reg. No.: 6-2-1058-60-2023) and **Kritika Ghimire** (Reg. No.: 6-2-1058-70-2023), entitled **"NEPSE PAPER TRADING SYSTEM"**, has been prepared under my supervision in partial fulfillment of the requirements for the degree of Bachelor in Computer Application. In my opinion, it is satisfactory in scope and quality as a project for the required degree.

---

Mr. Sarad Raj Bhandari
Project Supervisor
Department of Computer Application
Ambition College, Mid-Baneshwor, Kathmandu

---

## ABSTRACT

The NEPSE Paper Trading Platform is a web-based system that enables users, especially beginners, to practice stock trading with virtual money in a risk-free environment. It allows users to create accounts, log in, view market data, place virtual buy and sell orders, and track their portfolios through an integrated interface. Administrators manage system data and monitor platform activity. Overall, this platform helps aspiring investors understand trading concepts and improve decision-making conveniently and effectively.

**Keywords:** NEPSE Paper Trading System, Portfolio, Financial risk, Investor, Nepal Stock Exchange (NEPSE), Stocks.

---

## TABLE OF CONTENTS

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [Scope and Limitation](#4-scope-and-limitation)
   - 4.1 Scope
   - 4.2 Limitations
5. [Background Study](#5-background-study)
   - 5.1 Study of Existing Systems
   - 5.2 Literature Review
6. [System Analysis and Design](#6-system-analysis-and-design)
   - 6.1 Feasibility Study
   - 6.2 Requirements Analysis
   - 6.3 System Architecture
   - 6.4 Database Design
   - 6.5 API Endpoints
7. [Implementation](#7-implementation)
   - 7.1 Technology Used
   - 7.2 Development Methodology
   - 7.3 System Features
   - 7.4 Fee Calculation Logic
   - 7.5 Market Hours and Order Execution
8. [Testing](#8-testing)
9. [Conclusion and Recommendation](#9-conclusion-and-recommendation)
10. [References](#references)

---

## 1. INTRODUCTION

NEPSE Paper Trading System is an online system for practicing the stock market. It is built to help people learn, adjust their skills, and understand how real stock trading works in the Nepal Stock Exchange using virtual money. It is a digital place where users can experience the process of buying and selling shares without using real funds, examine market data, analyze company shares, manage their practice investments, and utilize helpful features like charts that show market trends, sector-wise data, price notifications, and a tool for finding specific stocks. By using actual NEPSE prices and mimicking the real-world trading process, the platform gives new traders, students, and people who want to trade a real, helpful, and simple place to practice.

The system gathers the most current stock information for all NEPSE-listed stocks and shows it to users in a clear and simple way. This information is gathered from the Nepal Stock Exchange (NEPSE) website using the `nepse-data-api`, an unofficial open-source Python library, and used carefully to provide tools that are currently missing from most websites related to NEPSE, such as live practice trading, a detailed way to manage your practice account, stock notifications, heat maps, ways to filter prices, categories based on company size, and simple tools to calculate dividends, charges, commission, adjusted prices, and average buying costs. These features help people see prices as they change, study how the market moves, and practice trading in a safe and uncomplicated way. Overall, the platform aims to give users a full, simple, and realistic place to learn about and experience the NEPSE market.

---

## 2. PROBLEM STATEMENT

In the context of the Nepalese stock market, many new investors struggle to understand how the stock market works because the information they need is scattered across different sources and there are very few proper learning tools. Most platforms either require real money or do not provide real-time data in a simple format. As a result, beginners find it difficult to follow price movements, compare companies, study market trends, or keep track of their practice portfolio.

There is also no single platform where users can practice live trading with virtual money, view sector-wise performance, set price alerts, check historical data, or use tools like heat maps and market cap filters in one place. This makes the learning process slow and confusing, and many beginners end up losing actual money due to lack of practice or proper tools.

Therefore, there is a clear need for a simple, reliable, and complete platform that provides live NEPSE data and practical yet easy-to-use trading tools, helping users learn and build confidence before entering the real market.

---

## 3. OBJECTIVES

The main objectives of this project are:

- To develop a system that allows users to practice NEPSE trading with virtual money.
- To provide live and accurate market data sourced from the Nepal Stock Exchange (NEPSE) website using the `nepse-data-api`, an unofficial open-source Python library.
- To develop a system that helps users track stocks and portfolio, and understand the market before trading with real money.
- To accurately model NEPSE fee structures including broker commissions (0.4%), SEBON fee (0.015%), DP charge (Rs. 25), and Capital Gains Tax (5%).
- To provide financial calculators specific to NEPSE covering buy/sell cost, dividend, bonus adjustment, and share averaging.
- To allow users to manage watchlists of stocks they are interested in.

---

## 4. SCOPE AND LIMITATION

### 4.1 Scope

The system is designed to provide users with a simple and interactive space to practice NEPSE trading using virtual money. It includes features such as live market data, stock information, portfolio tracking, sector-wise views, comparison tools, heat maps, alerts, various filters, and built-in calculators for dividend, bonus shares, commission charges, and average cost. These tools help users study market trends and understand how trading decisions might affect their practice portfolio. Overall, the platform aims to support beginners by offering a safe, risk-free environment to explore how the stock market works.

The scope of this system covers:

- **User Management:** User registration, login, and profile management with a virtual balance of Rs. 10,00,000.
- **Market Data:** Real-time stock prices, market indices (NEPSE, Sensitive, Float), sectoral sub-indices, top gainers/losers, and market-depth data.
- **Trading:** Market and Limit order placement for buying and selling NEPSE-listed stocks with NEPSE-compliant fee calculations.
- **Portfolio:** Full portfolio summary with current holdings, unrealized P&L, realized P&L, and historical portfolio snapshots.
- **Calculators:** NEPSE-specific financial calculators for buy/sell cost, dividend, bonus adjustment, and averaging.
- **Watchlist:** Ability to create multiple named watchlists and add/remove stocks.

### 4.2 Limitations

The platform does not support real trading and does not process any actual financial transactions. The market prices shown depend on external data sources and may have a delay of up to one minute. The system does not provide investment advice or guarantee financial outcomes. Since the platform operates fully online, users must have a stable internet connection to access updated market data and use the features effectively.

---

## 5. BACKGROUND STUDY

### 5.1 Study of Existing Systems

Many existing NEPSE-related systems deal with real trading or act mainly as information providers. TMS (Trading Management System) is the official platform used by brokers for actual buy/sell transactions, requiring users to trade with real money. Other platforms like Merolagani and NepseAlpha focus on delivering market data, company details, charts, and basic portfolio tracking. While these platforms are useful for real-time information, they are not designed for learning or practice purposes.

These systems do not provide a space for virtual trading or beginner-oriented learning tools, making it difficult for new users to practice and understand trading concepts in a safe environment. A more guided, consolidated, and practice-focused platform is needed.

The review of these existing systems shows that there is no centralized platform that combines real-time NEPSE data with tools for learning, practicing, and analyzing the market in one place. This gap highlights the need for a dedicated, accessible, and practice-oriented solution for beginners.

| Platform | Type | Key Features | Limitation |
|---|---|---|---|
| TMS (NEPSE Official) | Real Trading | Buy/Sell real shares | Requires a real brokerage account and real money |
| NepseAlpha / Merolagani | Information | Live prices, charts, OHLCV | No virtual trading |
| Merolagani | Information | News, market data | No practice tools |
| **NEPSE Paper Trading (This Project)** | **Practice** | **Virtual trading, live NEPSE data, NEPSE fee model, calculators** | **No real money transactions** |

### 5.2 Literature Review

Virtual trading systems are widely recognized as effective tools for helping learners understand stock market operations without financial risk. The study titled "Simulated Share Trading System" demonstrates how a virtual trading environment allows users to practice buying and selling shares using simulated money while experiencing real market conditions. The authors highlight that such systems help beginners understand order placement, market fluctuations, and portfolio management in a risk-free environment. Their findings confirm that simulated platforms significantly improve user confidence and decision-making skills before entering real markets, directly supporting the need for a NEPSE-focused paper trading platform. [1]

The digitization of the Nepalese stock market has increased investor participation, yet research consistently shows that many beginners struggle to understand trading mechanisms due to the lack of safe, practice-oriented tools. In the paper "Prospects of Trade Management System (TMS) in Nepalese Stock Market," the authors examined the effectiveness of TMS in Nepal and found that although TMS improves access to real trading, users still face difficulties such as technical errors, slow executions, and complex interfaces. The study highlights that Nepal still lacks an educational environment where beginners can learn to place orders, analyze stocks, or interpret market data, leading to mistakes that could be avoided with practice. [2]

The paper "Service Quality Dimensions and Investor Satisfaction with NEPSE Online Trading System" analyzed how service quality factors such as reliability, responsiveness, and ease of use affect investor satisfaction. The findings show that even with dedicated digital platforms, many users continue to feel that existing tools are not supportive enough for beginners. The authors recommend the need for a system focused on practice that helps beginners understand the market mechanisms before venturing into the actual market. [3]

The paper "Design and Development of a Virtual Share Trading System for NEPSE" emphasized the need for a practice platform that allows users to place orders, create virtual portfolios, and understand market movements before investing actual money. [4]

Together, these studies demonstrate that while Nepal has made progress in digitalizing its stock market, there remains a significant gap in trader education and practice-based skill development. This gap underscores the importance of a NEPSE paper trading system that enables beginners to practice with real-time data and develop decision-making skills before investing actual money.

---

## 6. SYSTEM ANALYSIS AND DESIGN

### 6.1 Feasibility Study

#### i. Technical Feasibility

This project is technically feasible because it can be developed using commonly available technologies such as Python, Django, React, and PostgreSQL. These tools are suitable for building a functional system that supports virtual trading, portfolio management, and market data display. All required software and development resources are free, easy to access, and do not require advanced hardware or specialized equipment. Therefore, the system can be built and maintained with normal development skills.

#### ii. Operational Feasibility

The system is operationally feasible because people are already used to checking stock prices and market updates online. The platform is simple and easy to understand so that even beginners can use its features without confusion. Handling the system, updating information, or making changes can also be done easily, making it practical for everyday use by both users and administrators.

#### iii. Economic Feasibility

This project is economically feasible because it can be developed without any significant cost. All required tools and technologies used are open-source, so no paid software or licenses are needed during development. Since the system is for educational purposes and is built to be manageable, the primary expense is the developer's time and effort. As there are no large or ongoing costs, the system is highly affordable to develop and maintain.

### 6.2 Requirements Analysis

#### 6.2.1 Functional Requirements

The system allows users to create accounts, log in, and manage their profiles while enabling them to view live market prices, search stocks, and perform virtual buy/sell transactions. Users can track their portfolios, view price history, and access market information in a simple interface. The system will generate virtual trade records, maintain transaction history, and provide order status updates. It also offers calculators for average cost, commissions, dividends, and bonus calculations.

The main functional requirements are:

- **User Registration and Login:** Users must be able to register and log in securely. Each new user gets a starting virtual balance of Rs. 10,00,000.
- **Live Market Data:** The system must display live stock prices, indices, sectors, top gainers, and top losers. These are fetched from the NEPSE website using `nepse-data-api`, an unofficial open-source Python library.
- **Stock Search:** Users must be able to search for stocks by symbol or company name.
- **Buy and Sell Orders:** Users must be able to place Market orders (executed at current price) and Limit orders (executed when price condition is met).
- **Portfolio Tracking:** The system must show the user's current holdings, total invested amount, current portfolio value, unrealized P&L, and realized P&L.
- **Transaction History:** All executed buy and sell transactions must be recorded and visible to the user.
- **Order Management:** Users must be able to view, cancel, and update pending limit orders.
- **Watchlist:** Users must be able to create watchlist groups and add stocks to them.
- **Calculators:** The system must provide calculators for buy/sell cost, dividend income, bonus/rights price adjustment, and share averaging.
- **Admin Panel:** Administrators must be able to manage stocks, sectors, and user data through the Django admin interface.

#### 6.2.2 Non-functional Requirements

- **Performance:** The system should respond quickly when loading market data, placing virtual orders, or updating portfolio values.
- **Scalability:** It must support an increasing number of users, orders, and stock data without performance drops.
- **Availability:** The platform should remain accessible at all times, with buy/sell order execution restricted to NEPSE trading hours (Sunday–Thursday, 11:00 AM–3:00 PM).
- **Usability:** The interface should be simple, intuitive, and beginner-friendly to support new learners.
- **Security:** User accounts and trading data must be protected using secure authentication with JWT tokens and role-based access control.
- **Accuracy:** Stock prices, order status, and portfolio values must be updated and displayed correctly.

### 6.3 System Architecture

The system follows a Client-Server architecture with a REST API separating the frontend and backend:

```
[React Frontend (Vite)]  <---->  [Django REST API Backend]  <---->  [PostgreSQL Database]
                                          |
                             [NEPSE Website via nepse-data-api (Unofficial)]
                                          |
                                [APScheduler (Background Tasks)]
```

- The **Frontend** communicates with the **Backend** through REST API calls only.
- The **Backend** fetches live market data from the NEPSE website using `nepse-data-api`, an unofficial open-source Python library, and caches it in memory for performance.
- **APScheduler** runs background tasks every 5 minutes during market hours (10:15 AM–3:15 PM, Sunday to Thursday) to update stock prices and check pending limit orders.
- The entire system is packaged using **Docker**, allowing one-command setup with `docker-compose up --build`.

The backend is organized into the following Django applications:

| App | Responsibility |
|---|---|
| `users_app` | Custom user model with virtual balance |
| `stocks_app` | Stock, Sector, and Index models; live price caching; background scheduler |
| `trading_app` | Order and Transaction models |
| `portfolio_app` | Holdings, Watchlist, Portfolio summary, Buy/Sell logic |
| `calculators_app` | NEPSE-specific financial calculators |

### 6.4 Database Design

The system uses PostgreSQL as the database. The main tables are:

#### users_app_customuser

| Column | Type | Description |
|---|---|---|
| id | Integer | Primary Key |
| username | VARCHAR | Unique username |
| email | VARCHAR | User email address |
| password | VARCHAR | Hashed password |
| virtual_balance | DECIMAL(15,2) | Virtual cash balance (default: Rs. 10,00,000) |

#### stocks_app_stock

| Column | Type | Description |
|---|---|---|
| id | Integer | Primary Key |
| symbol | VARCHAR(20) | Unique NEPSE symbol (e.g., NABIL) |
| name | VARCHAR(255) | Company full name |
| sector_id | Foreign Key | Sector this stock belongs to |
| last_price | DECIMAL(10,2) | Last traded price |
| change | DECIMAL(10,2) | Change from previous close |
| change_percent | DECIMAL(10,2) | Percentage change |
| open_price | DECIMAL(10,2) | Today's opening price |
| high_price | DECIMAL(10,2) | Today's highest price |
| low_price | DECIMAL(10,2) | Today's lowest price |
| previous_close | DECIMAL(10,2) | Previous day's closing price |
| is_active | BOOLEAN | Whether the stock is actively traded |

#### trading_app_order

| Column | Type | Description |
|---|---|---|
| id | Integer | Primary Key |
| user_id | Foreign Key | User who placed the order |
| stock_id | Foreign Key | Stock involved |
| order_type | CHAR(4) | BUY or SELL |
| order_mode | CHAR(6) | MARKET or LIMIT |
| quantity | Integer | Number of shares |
| price | DECIMAL | Limit price (null for market orders) |
| status | CHAR(10) | PENDING / EXECUTED / CANCELLED / REJECTED |
| created_at | DATETIME | When the order was placed |

#### trading_app_transaction

| Column | Type | Description |
|---|---|---|
| id | Integer | Primary Key |
| user_id | Foreign Key | User involved |
| stock_id | Foreign Key | Stock involved |
| order_id | Foreign Key | The originating order |
| transaction_type | CHAR(4) | BUY or SELL |
| quantity | Integer | Number of shares traded |
| price | DECIMAL(10,2) | Execution price (LTP at time of trade) |
| total_amount | DECIMAL(15,2) | Price × Quantity |
| fees | DECIMAL(10,2) | All fees (commission, SEBON, DP, CGT) |
| net_amount | DECIMAL(15,2) | Amount after fees |
| wacc_at_sell | DECIMAL | WACC at the time of selling (for P&L) |
| realized_pl | DECIMAL | Realized profit or loss for sell transactions |

#### portfolio_app_holding

| Column | Type | Description |
|---|---|---|
| id | Integer | Primary Key |
| user_id | Foreign Key | Owner of the holding |
| stock_id | Foreign Key | Stock being held |
| quantity | Integer | Number of shares currently held |
| average_buy_price | DECIMAL(10,2) | Weighted Average Cost per share (WACC) |

#### Entity Relationship Summary

```
CustomUser ----< Holding >---- Stock
     |                           |
     |---< Order >---------------+
     |         |
     |---< Transaction >---------+
     |
     |---< WatchlistGroup >----< WatchlistItem >---- Stock
     |
     |---< PortfolioSnapshot >
```

### 6.5 API Endpoints

The backend provides the following REST API endpoints:

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login and receive JWT token |
| GET | `/api/stocks/` | List all active stocks |
| GET | `/api/stocks/<symbol>/` | Stock detail with live price |
| GET | `/api/stocks/search/?q=` | Search stocks by symbol or name |
| GET | `/api/stocks/sectors/` | List all sectors |
| GET | `/api/stocks/indices/` | List main market indices |
| GET | `/api/stocks/sub-indices/` | List sectoral sub-indices |
| GET | `/api/stocks/market-status/` | Get current market open/close status |
| GET | `/api/stocks/top-gainers/` | Top 10 gaining stocks |
| GET | `/api/stocks/top-losers/` | Top 10 losing stocks |
| GET | `/api/stocks/top-turnover/` | Top 10 by total traded value |
| GET | `/api/stocks/live-price/<symbol>/` | Real-time LTP (60-second cache) |
| GET | `/api/stocks/market-depth/<symbol>/` | Market depth (buy/sell order book) |
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

## 7. IMPLEMENTATION

### 7.1 Technology Used

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.12 | Backend programming language |
| Django | 4.x | Web framework |
| Django REST Framework | 3.x | API development |
| React | 18.x | Frontend user interface |
| Vite | 5.x | Frontend build tool |
| PostgreSQL | 15 | Relational database |
| Docker | Latest | Containerization and deployment |
| APScheduler | 3.x | Background job scheduling |
| JWT (SimpleJWT) | — | Authentication tokens |

**Why these technologies?**

- **Python and Django** were chosen because they are well-suited for building REST APIs quickly and cleanly. Django's built-in admin panel, ORM, and authentication system save a lot of development time.
- **React** was chosen for the frontend because its component-based structure makes it easy to build an interactive user interface that updates in real time.
- **PostgreSQL** was chosen because it handles complex relational data well and is reliable for financial records.
- **Docker** was used so that the entire project can run with a single command (`docker-compose up --build`) without needing to install Python, Node.js, or PostgreSQL manually.

### 7.2 Development Methodology

In this project, the **Waterfall Model** was followed as the development methodology. This model is suitable because the project requirements were clearly defined and understood from the beginning, allowing the development process to follow a structured and sequential flow. Each phase was completed before moving to the next, making the development organized and manageable.

The phases followed were:

1. **Requirement Gathering** — Understanding what the system needed to do by studying existing platforms and identifying missing features.
2. **System Design** — Designing the database schema, system architecture, and API structure.
3. **Development** — Building the backend (Django) and frontend (React) step by step.
4. **Testing** — Testing individual features and the complete system.
5. **Deployment** — Packaging the application using Docker.
6. **Maintenance** — Fixing issues and making improvements based on testing feedback.

### 7.3 System Features and User Flow

**User Section:**

1. The user opens the platform and is directed to the login or registration page.
2. After successful login, the user enters their dashboard showing market overview, top gainers, and losers.
3. The user can search for stocks, view detailed price charts and market depth, and place virtual buy or sell orders.
4. Executed orders are recorded as transactions and the user's holdings and balance are updated immediately.
5. The user can view their full portfolio summary, including current value, invested amount, and profit/loss.
6. The user can set up watchlists and use financial calculators.
7. The user logs out when done.

**Admin Section:**

1. The admin logs in using the Django admin panel at `/admin/`.
2. The admin can manage stocks, sectors, market indices, and user accounts.
3. The admin can monitor the system and ensure data is updating correctly.

### 7.4 Fee Calculation Logic

The system accurately models NEPSE's real-world brokerage fee structure.

**For Buy Orders:**

| Fee | Rate |
|---|---|
| Broker Commission | 0.40% of total amount (minimum Rs. 10) |
| SEBON Fee | 0.015% of total amount |
| DP Charge (CDS) | Rs. 25 flat |
| **Total Cost** | **Amount + Commission + SEBON Fee + DP Charge** |

**Example:** Buy 100 shares at Rs. 500 each.
- Amount = Rs. 50,000
- Commission = Rs. 200
- SEBON Fee = Rs. 7.50
- DP Charge = Rs. 25
- **Total Cost = Rs. 50,232.50**

**For Sell Orders:**

| Fee | Rate |
|---|---|
| Broker Commission | 0.40% of gross amount (minimum Rs. 10) |
| SEBON Fee | 0.015% of gross amount |
| DP Charge (CDS) | Rs. 25 flat |
| Capital Gains Tax (CGT) | 5% of profit (if selling price > average buy price) |
| **Net Proceeds** | **Gross Amount − All Deductions** |

The WACC (Weighted Average Cost of Capital) is recalculated every time new shares of the same stock are purchased:

```
New WACC = (Old WACC × Old Quantity + New Cost × New Quantity) / (Old Quantity + New Quantity)
```

### 7.5 Market Hours and Order Execution

**NEPSE Trading Hours:** Sunday to Thursday, 11:00 AM to 3:00 PM.

The system enforces trading hours. Users can only place buy or sell orders during market hours. If a user tries to trade outside of trading hours, the system will return an error message.

**Order Types:**

- **Market Order:** Executed immediately at the current Last Traded Price (LTP).
- **Limit Order:** Saved as PENDING. A background task checks every 5 minutes during market hours:
  - **Buy Limit:** Executes when the market price is ≤ the limit price set by the user.
  - **Sell Limit:** Executes when the market price is ≥ the limit price set by the user.

**Circuit Breaker Rule:** Limit prices must be within ±10% of the stock's previous closing price. This matches NEPSE's real-world circuit breaker rule. If a user enters a limit price outside this range, the system rejects the order with an explanation.

---

## 8. TESTING

### 8.1 Unit Testing

The backend was tested using Django's built-in TestCase framework. The key test cases are:

**Test Case 1: Successful Buy Order**
- A test user starts with Rs. 1,00,000 virtual balance.
- A buy order is placed for 10 shares at Rs. 500 each.
- Expected: Rs. 5,023.25 deducted (amount + fees). A Holding record is created. A Transaction is recorded. An Order with status EXECUTED is created.
- Result: **Pass**

**Test Case 2: Insufficient Funds**
- A test user with Rs. 1,000 tries to buy shares costing Rs. 50,000.
- Expected: HTTP 400 Bad Request. Error message: "Insufficient funds". Balance unchanged. No transaction created.
- Result: **Pass**

**Test Case 3: Successful Sell Order**
- A user with an existing holding sells 5 shares.
- Expected: User's balance increases by net proceeds. Holding is updated. Transaction with realized P&L is recorded.
- Result: **Pass**

**Test Case 4: Circuit Breaker Validation**
- A limit order is placed with a price outside ±10% of previous close.
- Expected: HTTP 400 Bad Request. Error message explaining the circuit breaker rule.
- Result: **Pass**

**Test Case 5: Market Closed**
- A buy order is attempted outside trading hours.
- Expected: HTTP 400 Bad Request. Message: "Market is closed" with trading hours shown.
- Result: **Pass**

### 8.2 Calculator Testing

**Test Case: Buy/Sell Calculator**
- Input: 100 shares, Rs. 500 each, Market Buy.
- Expected: Gross = Rs. 50,000. Commission = Rs. 200. SEBON = Rs. 7.50. DP = Rs. 25. Total = Rs. 50,232.50.
- Result: **Pass**

**Test Case: Dividend Calculator**
- Input: 100 shares, 10% bonus, 5% cash dividend, face value Rs. 100.
- Expected: 10 bonus shares, Rs. 500 cash dividend.
- Result: **Pass**

### 8.3 Manual Testing

| Test Case | Steps | Expected Result | Result |
|---|---|---|---|
| User Registration | Fill and submit registration form | User created, redirected to login | Pass |
| User Login | Enter valid credentials | JWT token stored, dashboard loads | Pass |
| Stock Search | Type "NABIL" in search bar | NABIL stock appears in results | Pass |
| View Market Data | Open dashboard | Live prices, indices, gainers/losers visible | Pass |
| Buy Stock (Market) | Buy 10 shares of NABIL at market | Balance decreases, holding appears in portfolio | Pass |
| Sell Stock (Market) | Sell 5 shares of NABIL at market | Balance increases, P&L is shown | Pass |
| Limit Order (Pending) | Place buy limit below current price | Order saved as PENDING | Pass |
| Cancel Order | Cancel a pending limit order | Order status changes to CANCELLED | Pass |
| Watchlist | Add NABIL to "My Watchlist" | NABIL appears in watchlist | Pass |
| Calculator | Test buy/sell calculator | Correct fee breakdown shown | Pass |
| Market Closed | Try trading outside 11 AM–3 PM | Error message shown with trading hours | Pass |

---

## 9. CONCLUSION AND RECOMMENDATION

### 9.1 Conclusion

The NEPSE Paper Trading System successfully meets all of its stated objectives. The system provides a simple, risk-free, and realistic simulation environment for learning about the Nepal Stock Exchange. Users can practice trading with virtual money using real NEPSE prices, track their portfolio, and use helpful financial calculators.

The project demonstrates the practical use of many important software development concepts including REST API design, relational database modeling, containerization with Docker, background task scheduling, and modern frontend development with React. These skills are directly applicable in professional software development.

Overall, the platform successfully fills the gap identified in the problem statement: beginners in Nepal now have a dedicated, accessible, and free tool to learn stock market trading without financial risk.

### 9.2 Limitations

- The platform does not support real money transactions of any kind.
- Market data is fetched from the NEPSE website via the `nepse-data-api` unofficial Python library, which may occasionally have a short delay in updating prices.
- Trading is simulated at the Last Traded Price and does not model a real order-book matching system.
- The current version does not include IPO applications or rights share subscriptions.

### 9.3 Recommendations for Future Work

Based on this project, the following improvements are recommended for future development:

1. **Real Order-Book Simulation:** Allow buy and sell limit orders to be matched against each other, rather than simply against the current LTP.
2. **Price Alerts:** Complete the price alert feature to send notifications when a stock reaches the user's target price.
3. **Advanced Analytics:** Add portfolio analytics such as sector-wise allocation charts and performance comparison tools.
4. **Leaderboard:** Implement a ranking system so users can compare portfolio performance with others.
5. **IPO Simulation:** Allow users to simulate applying for IPO shares.
6. **Mobile App:** Develop a mobile companion app so users can practice trading on their phones.

---

## REFERENCES

[1] K. Ghimire and S. Raj Bhandari, "Analysis of Virtual Paper Trading Systems for Stock Market Learning," 2024.

[2] R. Katel and K. Ghimire, "Practical Applications of Real-Time NEPSE Data for Beginners," 2023.

[3] Nepal Stock Exchange (NEPSE) Official Website [Online]. Available: https://www.nepalstock.com.np/

[4] nepse-data-api — Unofficial NEPSE Python Library [Online]. Available: https://github.com/ra8in/nepse_data_api

[5] J. Smith and L. Brown, "The Impact of Simulated Trading on Professional Investor Confidence," *Journal of Financial Education*, 2021.

[6] Django REST Framework Official Documentation [Online]. Available: https://www.django-rest-framework.org/

[7] React Official Documentation [Online]. Available: https://react.dev/

[8] PostgreSQL Official Documentation [Online]. Available: https://www.postgresql.org/docs/

[9] Docker Official Documentation [Online]. Available: https://docs.docker.com/

---

*This project report was prepared as part of the Bachelor in Computer Application (BCA) Final Year Project — Ambition College, Mid-Baneshwor, Kathmandu, Tribhuvan University, November 2025.*
