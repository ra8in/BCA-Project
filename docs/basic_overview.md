i am building the nepse paper trading for the college project, i am using db postgre sql with timescale db, django as a backend and i want to use the react so how will i use it which django framework will i useNO code just answer my question no schema for now just answer my question and make me understand7:06 PMGreat project! Here's how you should approach this:
Backend Framework Choice
Use Django REST Framework (DRF) - not vanilla Django. Here's why:
Django by itself is built for server-side rendered applications (it generates HTML on the server). But since you want to use React for your frontend, you need Django to work as a pure API that sends and receives JSON data. DRF is specifically designed for this purpose.
How It Works Together
Think of it as two separate applications that talk to each other:
Django + DRF (Backend):

Handles all your business logic (buy/sell orders, portfolio calculations, etc.)
Manages your PostgreSQL/TimescaleDB database
Provides API endpoints (URLs that React can call)
Handles authentication and authorization
Example: when someone places a trade, DRF receives the request, validates it, saves to database, and sends back a response

React (Frontend):

Runs completely separately (usually on a different port during development)
Handles all the UI - charts, forms, buttons, displays
Makes HTTP requests to your Django API to get or send data
Example: when user clicks "Buy Stock", React sends a POST request to your Django API endpoint

The Communication Flow
When a user wants to buy a stock:

They click "Buy" in React
React sends an HTTP request to http://your-django-api.com/api/trades/
Django DRF receives it, processes the trade, updates database
Django sends back JSON response (success/failure)
React receives the response and updates the UI accordingly

Why This Architecture?
This separation is called "decoupled architecture". Django doesn't know or care what frontend you're using - could be React, Vue, mobile app, whatever. They just communicate through standard HTTP requests. This makes your application more flexible and scalable.
For your NEPSE paper trading project, this setup is perfect because you'll likely need real-time stock data, complex calculations, and a responsive UI - DRF handles the heavy lifting while React makes it smooth and interactive for users.
Does this make sense? Would you like me to clarify any part of this architecture?ok, so will i have to use complete react or i will also use the django template those are really powerfull7:07 PMAh, good question! You need to choose one approach - you can't really mix Django templates with React effectively. Here's why:
The Two Approaches:
Approach 1: Django Templates Only (Traditional)

Django renders everything on the server
You write HTML templates with Django template language
Yes, they're powerful - you can use template tags, filters, includes
Good for: simpler applications, SEO-focused sites, when you don't need much interactivity

Approach 2: React Only (What you should do)

Django is JUST an API (no templates at all, except maybe one simple HTML file to load React)
React handles 100% of the UI
All pages, all components, all interactions happen in React
Good for: interactive dashboards, real-time updates, modern UX

Why You Can't Mix Them Well:
Django templates and React have conflicting philosophies:

Django templates render HTML on the server and send complete pages
React wants to control the entire DOM and render dynamically on the client
If you try to mix them, you'll fight constant battles over who controls what

For Your NEPSE Paper Trading Project:
You should go full React because:

You'll need real-time stock price updates
Interactive charts and graphs
Dynamic portfolio updates without page refreshes
Smooth user experience for quick trading actions
Modern, responsive dashboard feel

Django templates would make all of this clunky - you'd be doing full page reloads or complicated AJAX just to update a stock price.
What You Lose from Django Templates:
Honestly? Not much for your use case. React is actually MORE powerful for building interactive UIs. The "power" of Django templates is really for server-side rendering, which you don't need here.
Bottom line: Go full React for frontend, Django DRF purely as API backend. Don't look back at Django templates for this project.like in the next js will i have to run multiple server for frontend and django or just one of django?7:09 PMExcellent question! This is an important practical consideration.
Development vs Production - Different Setups:
During Development (on your laptop):
You'll run TWO separate servers:

Django development server on localhost:8000 (your API)
React development server on localhost:3000 (your frontend)

They run independently, and React makes requests to Django's port.
In Production (when you deploy):
You have TWO main options:
Option 1: Single Server (Simpler for college projects)

Build your React app into static files (HTML, CSS, JS bundles)
Configure Django to serve these static files
Everything runs through Django on one server/port
This is what most people do for smaller projects

How it works: When you "build" React, it creates optimized static files. Django just serves these files like any other static content (like images or CSS). Django handles both the API requests AND serving your React frontend.
Option 2: Two Separate Servers (More "professional" but overkill for you)

Host Django API on one server (e.g., api.yourproject.com)
Host React frontend on another (e.g., yourproject.com)
React makes requests to the separate API server
This is what big companies do, but unnecessary for college projects

For Your NEPSE Project:
Go with Option 1 - single server in production. It's:

Simpler to deploy
Cheaper (one hosting service instead of two)
Easier to manage
Perfectly fine for a college project

During development, yes you'll run two terminals (one for Django, one for React), but that's normal and not a problem.
Unlike Next.js (which is a full-stack framework), React is just frontend, so this is the standard approach. Next.js is different because it has its own backend capabilities, but that's a whole other discussion.
Does this clear things up?Doc1_1.pdf331 linespdfthis is my proposal now see the whole plan of mine.7:26 PMAlright, I've read through your entire proposal. Let me give you a clear picture of how everything fits together for your NEPSE Paper Trading System:
Your Tech Stack Makes Perfect Sense
Django + DRF + React + PostgreSQL/TimescaleDB is an excellent choice for this project. Here's why it all connects:
TimescaleDB Choice
You're using TimescaleDB (which extends PostgreSQL) - this is smart because:

You need to store time-series stock price data (prices changing every minute)
TimescaleDB is optimized for exactly this - storing and querying time-stamped data efficiently
You can easily track historical prices, calculate trends, generate charts
Perfect for your heatmaps and price movement features

Django DRF as Backend
Your backend will handle:

User authentication (login/register from your flowchart)
Virtual trading logic (buy/sell order execution)
Portfolio calculations (profit/loss, average cost)
All those calculators you mentioned (dividend, commission, bonus shares)
Admin panel for monitoring users and updating system
Fetching data from ShareHub Nepal (respecting rate limits as you mentioned)
Storing everything in TimescaleDB

React as Frontend
Your frontend will provide:

User dashboard with all those features you listed
Real-time market data display
Interactive charts and heatmaps
Stock comparison tools
Search and filter functionality
Price alerts/notifications
All the UI from your use case diagram

How It Maps to Your Proposal
Your functional requirements (from section 5.1.3.1) - all handled by React calling Django APIs:

User creates account → React form → Django API creates user
View live prices → React requests → Django fetches from ShareHub → returns JSON
Place buy/sell order → React sends order → Django validates, calculates commission, updates portfolio in TimescaleDB
Track portfolio → React displays data from Django API
Admin monitoring → Separate React admin interface calling Django admin APIs

Your non-functional requirements:

Performance: React's fast UI + Django's efficient API + TimescaleDB's optimized queries
Scalability: Django handles multiple users well, TimescaleDB scales with time-series data
Availability: Your trading hours restriction (11 AM - 3 PM) gets enforced in Django backend logic
Security: Django has built-in authentication, DRF handles API security

Development Flow (Based on Your Waterfall Model)

Requirement Gathering ✓ (You've done this in your proposal)
System Design:

Design your Django models (User, Stock, Order, Portfolio, Transaction)
Design API endpoints structure
Design React component hierarchy


Development:

Set up Django + DRF + TimescaleDB
Build APIs for all features
Build React frontend separately
Connect them via API calls


Testing: Test both separately and together
Deployment: Build React to static files, serve through Django (as we discussed earlier)

Your Gantt Chart Timeline
Looking at your timeline (Nov 2025 - April 2026), you have about 5 months. This is realistic for a two-person college project with this scope.
One Important Clarification
Since you're fetching data from ShareHub Nepal and they have rate limits, Django will:

Periodically fetch and cache stock data in your TimescaleDB
Serve this cached data to React (not fetching from ShareHub on every user request)
Update every minute or so (respecting the "up to one minute delay" you mentioned in limitations)

This way you don't hit rate limits and your app stays fast.
Does this all make sense now? Can you see how Django DRF + React + TimescaleDB work together to build all the features in your proposal?now give me whole detailed plan what i am build what i the system, what tool for what in detailed way.7:27 PMComplete Detailed Plan for NEPSE Paper Trading System
1. SYSTEM ARCHITECTURE OVERVIEW
Architecture Type: Decoupled Frontend-Backend Architecture
User Browser (React) ←→ HTTP/REST API ←→ Django Backend ←→ TimescaleDB/PostgreSQL
                                              ↓
                                      External: ShareHub Nepal API

2. TECHNOLOGY STACK BREAKDOWN
2.1 Frontend Technologies
React.js - Main frontend framework

Purpose: Build the entire user interface
What you'll build with it:

User Dashboard
Market Data Display pages
Buy/Sell order forms
Portfolio tracking interface
Stock comparison tools
Admin dashboard interface



Additional Frontend Libraries You'll Need:

React Router (react-router-dom)

Purpose: Handle navigation between pages
What you'll use it for: Login page → Dashboard → Portfolio page → Market Data page routing


Axios or Fetch API

Purpose: Make HTTP requests to Django backend
What you'll use it for: Every API call (login, fetch stocks, place orders, get portfolio)


Recharts or Chart.js or TradingView Lightweight Charts

Purpose: Display stock price charts
What you'll use it for: Candlestick charts, line charts, price movement visualization


Material-UI (MUI) or Ant Design or TailwindCSS

Purpose: UI component library and styling
What you'll use it for: Buttons, tables, forms, cards, modals - all your UI elements


React Query or SWR (optional but recommended)

Purpose: Data fetching and caching
What you'll use it for: Efficiently fetch and cache market data, auto-refresh prices


Socket.io-client (optional - for future real-time features)

Purpose: WebSocket connection for real-time updates
What you'll use it for: Live price updates without refreshing page


React Hook Form

Purpose: Form handling and validation
What you'll use it for: Login, registration, buy/sell order forms


Day.js or date-fns

Purpose: Date/time manipulation
What you'll use it for: Displaying transaction timestamps, filtering by date




2.2 Backend Technologies
Python Django - Main backend framework

Purpose: Handle all business logic and serve APIs
Version: Django 4.2+ (LTS version)

Django REST Framework (DRF)

Purpose: Build RESTful APIs
What you'll build with it:

Authentication endpoints (login, register, logout)
Stock data endpoints
Order placement endpoints
Portfolio endpoints
User management endpoints
Admin endpoints



Additional Backend Libraries You'll Need:

djangorestframework-simplejwt

Purpose: JWT token-based authentication
What you'll use it for: Secure API authentication (tokens for login sessions)


django-cors-headers

Purpose: Handle Cross-Origin Resource Sharing
What you'll use it for: Allow React (localhost:3000) to communicate with Django (localhost:8000) during development


psycopg2 or psycopg2-binary

Purpose: PostgreSQL database adapter
What you'll use it for: Connect Django to PostgreSQL/TimescaleDB


Celery + Redis

Purpose: Background task processing
What you'll use it for:

Fetch stock data from ShareHub Nepal every minute
Send price alerts to users
Generate daily portfolio reports
Process calculations without blocking API requests




requests or httpx

Purpose: Make HTTP requests to external APIs
What you'll use it for: Fetch data from ShareHub Nepal API


django-environ

Purpose: Manage environment variables
What you'll use it for: Store secret keys, database credentials, API keys securely


drf-spectacular or drf-yasg

Purpose: Auto-generate API documentation
What you'll use it for: Document all your API endpoints for frontend development


django-filters

Purpose: Add filtering to API endpoints
What you'll use it for: Filter stocks by sector, price range, market cap, etc.


Channels (optional - for future WebSocket support)

Purpose: Handle WebSockets in Django
What you'll use it for: Real-time price updates pushed to frontend




2.3 Database Technologies
PostgreSQL - Base relational database

Purpose: Store all structured data
Version: PostgreSQL 14+

TimescaleDB Extension

Purpose: Optimize time-series data storage and queries
What you'll store in TimescaleDB:

Stock price history (timestamp, stock_id, open, high, low, close, volume)
Order execution history with timestamps
Portfolio value history over time
Market indices changes over time



Why Both?

PostgreSQL stores: Users, Stocks (company info), Orders, Portfolio holdings, Transactions
TimescaleDB (hypertables) stores: Time-series price data, historical market data


3. DETAILED SYSTEM COMPONENTS
3.1 Django Backend Structure
Django Apps (Modular structure):
1. users app

Purpose: Handle user authentication and profiles
Models:

CustomUser (extends Django's User): email, username, virtual_balance, created_at


API Endpoints:

POST /api/users/register/ - Register new user
POST /api/users/login/ - Login (returns JWT token)
POST /api/users/logout/ - Logout
GET /api/users/profile/ - Get user profile
PUT /api/users/profile/ - Update profile
GET /api/users/balance/ - Get virtual balance



2. stocks app

Purpose: Manage stock data and market information
Models:

Stock: symbol, name, sector, market_cap, listed_shares, created_at
StockPrice (TimescaleDB hypertable): stock_id, timestamp, open, high, low, close, volume, change_percent
Sector: name, description


API Endpoints:

GET /api/stocks/ - List all stocks (with filters: sector, market_cap range)
GET /api/stocks/{symbol}/ - Get specific stock details
GET /api/stocks/{symbol}/prices/ - Get price history (time range filter)
GET /api/stocks/{symbol}/current-price/ - Get latest price
GET /api/stocks/search/?q=keyword - Search stocks by name/symbol
GET /api/stocks/sectors/ - List all sectors with performance
GET /api/stocks/heatmap/ - Get data for heatmap visualization



3. trading app

Purpose: Handle buy/sell orders and order execution
Models:

Order: user, stock, order_type (BUY/SELL), quantity, price, status (PENDING/EXECUTED/CANCELLED), timestamp
Transaction: order, execution_price, commission, total_amount, executed_at


API Endpoints:

POST /api/trading/orders/ - Place buy/sell order
GET /api/trading/orders/ - Get user's order history
GET /api/trading/orders/{id}/ - Get specific order details
DELETE /api/trading/orders/{id}/ - Cancel pending order
GET /api/trading/transactions/ - Get transaction history
POST /api/trading/validate-order/ - Validate order before placing (check balance, market hours)



4. portfolio app

Purpose: Track user holdings and portfolio performance
Models:

Holding: user, stock, quantity, average_buy_price, current_value, profit_loss
PortfolioSnapshot (TimescaleDB): user, timestamp, total_value, cash_balance, invested_amount


API Endpoints:

GET /api/portfolio/ - Get current portfolio summary
GET /api/portfolio/holdings/ - Get all holdings with current prices
GET /api/portfolio/performance/ - Get portfolio performance over time
GET /api/portfolio/profit-loss/ - Get overall profit/loss
GET /api/portfolio/history/?start_date=&end_date= - Get historical portfolio value



5. alerts app

Purpose: Manage price alerts and notifications
Models:

PriceAlert: user, stock, target_price, alert_type (ABOVE/BELOW), is_active, triggered_at
Notification: user, message, type, is_read, created_at


API Endpoints:

POST /api/alerts/ - Create price alert
GET /api/alerts/ - Get user's active alerts
DELETE /api/alerts/{id}/ - Delete alert
GET /api/notifications/ - Get user notifications
PATCH /api/notifications/{id}/mark-read/ - Mark notification as read



6. calculators app

Purpose: Provide calculation utilities
API Endpoints (all POST requests with calculation parameters):

POST /api/calculators/commission/ - Calculate brokerage commission
POST /api/calculators/dividend/ - Calculate dividend returns
POST /api/calculators/bonus/ - Calculate bonus share adjustments
POST /api/calculators/average-cost/ - Calculate average buying cost
POST /api/calculators/break-even/ - Calculate break-even price



7. market_data app

Purpose: Fetch and manage data from ShareHub Nepal
Models:

DataFetchLog: timestamp, source, status, records_updated
MarketStatus: is_open, current_session, last_updated


Celery Tasks:

fetch_stock_prices_task() - Runs every 1 minute during market hours
fetch_company_info_task() - Runs daily after market close
check_price_alerts_task() - Runs every minute to trigger alerts


API Endpoints:

GET /api/market/status/ - Check if market is open
GET /api/market/indices/ - Get NEPSE index, sensitive index, etc.



8. admin_panel app

Purpose: Admin-specific features
API Endpoints:

GET /api/admin/users/ - List all users with stats
GET /api/admin/analytics/ - Platform usage analytics
GET /api/admin/logs/ - System logs
PATCH /api/admin/users/{id}/activate/ - Activate/deactivate user
GET /api/admin/data-fetch-status/ - Check data fetching health




3.2 React Frontend Structure
Folder Structure:
src/
├── components/           # Reusable components
│   ├── common/          # Buttons, Cards, Modals, etc.
│   ├── charts/          # Chart components
│   ├── forms/           # Form components
│   └── layout/          # Header, Footer, Sidebar
├── pages/               # Page components
│   ├── Auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── Dashboard/
│   │   └── Dashboard.jsx
│   ├── Market/
│   │   ├── MarketOverview.jsx
│   │   ├── StockDetail.jsx
│   │   └── Heatmap.jsx
│   ├── Trading/
│   │   ├── BuySell.jsx
│   │   └── OrderHistory.jsx
│   ├── Portfolio/
│   │   ├── Portfolio.jsx
│   │   └── Holdings.jsx
│   ├── Alerts/
│   │   └── Alerts.jsx
│   ├── Calculators/
│   │   └── Calculators.jsx
│   └── Admin/
│       └── AdminDashboard.jsx
├── services/            # API service functions
│   ├── api.js           # Axios instance with base URL
│   ├── authService.js   # Login, register, logout functions
│   ├── stockService.js  # Stock-related API calls
│   ├── tradingService.js
│   ├── portfolioService.js
│   └── alertService.js
├── context/             # React Context for state management
│   ├── AuthContext.jsx  # User authentication state
│   └── MarketContext.jsx # Market status, current prices
├── hooks/               # Custom React hooks
│   ├── useAuth.js
│   ├── useStockPrice.js
│   └── usePortfolio.js
├── utils/               # Utility functions
│   ├── formatters.js    # Format currency, dates, percentages
│   ├── validators.js    # Form validation helpers
│   └── constants.js     # Constants (API URLs, trading hours)
├── App.jsx              # Main app component with routing
└── main.jsx             # Entry point
Key React Pages/Components:
1. Authentication Pages

Login.jsx: Login form → calls authService.login() → stores JWT token → redirects to dashboard
Register.jsx: Registration form → calls authService.register() → auto-login

2. Dashboard.jsx

Shows: Portfolio summary, recent transactions, market overview, quick actions
Components: PortfolioSummaryCard, RecentTransactions, MarketIndices, QuickTradeButton

3. Market Pages

MarketOverview.jsx:

Lists all stocks in a table
Filters: sector, price range, market cap
Search functionality
Sorting by price, change%, volume


StockDetail.jsx:

Detailed stock info: current price, charts, company details
Buy/Sell buttons
Price history chart (using Recharts)
Similar stocks comparison


Heatmap.jsx:

Visual heatmap of all stocks colored by % change
Sector-wise view



4. Trading Pages

BuySell.jsx:

Stock selector (dropdown or search)
Quantity input
Shows: current price, total cost, commission, available balance
Preview before confirming
Validates: market hours, sufficient balance, minimum quantity


OrderHistory.jsx:

Table of all orders (pending, executed, cancelled)
Filter by date, type, status



5. Portfolio Pages

Portfolio.jsx:

Overview: total value, cash balance, invested amount, profit/loss
Portfolio performance chart over time


Holdings.jsx:

Table of all holdings
Shows: stock, quantity, avg buy price, current price, P/L, P/L%
Quick sell button for each holding



6. Alerts.jsx

Create new price alert form
List of active alerts
Delete/edit alerts
Notification list

7. Calculators.jsx

Tabs for different calculators:

Commission calculator
Dividend calculator
Bonus share calculator
Average cost calculator
Break-even calculator


Input fields → call API → display results

8. Admin Dashboard

User management table
Platform statistics
Data fetch status monitoring
System logs viewer


4. DATABASE SCHEMA DESIGN
PostgreSQL Tables (Regular tables):
users_customuser
- id (PK)
- username (unique)
- email (unique)
- password (hashed)
- virtual_balance (decimal, default: 1000000.00)
- is_active (boolean)
- is_admin (boolean)
- created_at (timestamp)
stocks_stock
- id (PK)
- symbol (unique, e.g., 'NABIL')
- name (e.g., 'Nabil Bank Limited')
- sector_id (FK to sectors_sector)
- market_cap (decimal)
- listed_shares (integer)
- created_at (timestamp)
stocks_sector
- id (PK)
- name (e.g., 'Commercial Banks')
- description (text)
trading_order
- id (PK)
- user_id (FK)
- stock_id (FK)
- order_type (ENUM: 'BUY', 'SELL')
- quantity (integer)
- price (decimal) - price at which order placed
- status (ENUM: 'PENDING', 'EXECUTED', 'CANCELLED')
- created_at (timestamp)
trading_transaction
- id (PK)
- order_id (FK)
- execution_price (decimal) - actual price at execution
- commission (decimal)
- sebon_fee (decimal)
- dp_fee (decimal)
- total_amount (decimal)
- executed_at (timestamp)
portfolio_holding
- id (PK)
- user_id (FK)
- stock_id (FK)
- quantity (integer)
- average_buy_price (decimal)
- last_updated (timestamp)
- UNIQUE(user_id, stock_id)
alerts_pricealert
- id (PK)
- user_id (FK)
- stock_id (FK)
- target_price (decimal)
- alert_type (ENUM: 'ABOVE', 'BELOW')
- is_active (boolean)
- triggered_at (timestamp, nullable)
- created_at (timestamp)
alerts_notification
- id (PK)
- user_id (FK)
- message (text)
- type (ENUM: 'ALERT', 'ORDER', 'SYSTEM')
- is_read (boolean)
- created_at (timestamp)
TimescaleDB Hypertables (Time-series data):
stocks_stockprice (hypertable partitioned by time)
- timestamp (PK component)
- stock_id (FK, PK component)
- open (decimal)
- high (decimal)
- low (decimal)
- close (decimal)
- volume (integer)
- change_percent (decimal)
portfolio_portfoliosnapshot (hypertable)
- timestamp (PK component)
- user_id (FK, PK component)
- total_value (decimal)
- cash_balance (decimal)
- invested_amount (decimal)
- profit_loss (decimal)
market_data_marketindex (hypertable)
- timestamp (PK)
- index_name (e.g., 'NEPSE', 'SENSITIVE')
- value (decimal)
- change (decimal)
- change_percent (decimal)

5. KEY FEATURES IMPLEMENTATION DETAILS
5.1 User Authentication Flow
Registration:

User fills form in React (username, email, password)
React validates form → sends POST to /api/users/register/
Django creates user with virtual_balance = 1,000,000 (1 million starting capital)
Django returns success → React auto-logs in user
JWT token stored in localStorage
Redirect to dashboard

Login:

User enters credentials
React sends POST to /api/users/login/
Django validates → returns JWT access + refresh tokens
React stores tokens → updates AuthContext
All subsequent API calls include token in Authorization header

Logout:

User clicks logout
React clears tokens from localStorage
Updates AuthContext
Redirects to login page


5.2 Market Data Fetching System
Celery Periodic Task (runs every minute during trading hours):
python@shared_task
def fetch_stock_prices_task():
    # Check if market is open (Sunday-Friday, 11 AM - 3 PM Nepal time)
    if not is_market_open():
        return
    
    # Fetch data from ShareHub Nepal API
    response = requests.get('SHAREHUB_API_URL')
    data = response.json()
    
    # For each stock in response:
    for stock_data in data:
        # Get or create Stock object
        stock = Stock.objects.get(symbol=stock_data['symbol'])
        
        # Create StockPrice entry (TimescaleDB hypertable)
        StockPrice.objects.create(
            stock=stock,
            timestamp=now(),
            open=stock_data['open'],
            high=stock_data['high'],
            low=stock_data['low'],
            close=stock_data['close'],
            volume=stock_data['volume'],
            change_percent=stock_data['change_percent']
        )
    
    # Check for triggered price alerts
    check_price_alerts_task.delay()
Rate Limit Handling:

Cache ShareHub data for 1 minute
All user requests served from database, not ShareHub
Only Celery task hits ShareHub API


5.3 Order Placement and Execution
Buy Order Flow:

Frontend (React BuySell.jsx):

User selects stock, enters quantity
Shows preview: price × quantity + commission
Validates: balance sufficient, quantity > 0, market hours


API Request:

javascript   tradingService.placeOrder({
     stock_symbol: 'NABIL',
     order_type: 'BUY',
     quantity: 10
   })

Backend (Django trading/views.py):

python   def place_order(request):
       # Validate market hours
       if not is_market_open():
           return Response({'error': 'Market closed'}, status=400)
       
       # Get current stock price from latest StockPrice
       current_price = StockPrice.objects.filter(
           stock__symbol=request.data['stock_symbol']
       ).latest('timestamp').close
       
       # Calculate costs
       total_cost = current_price * quantity
       commission = calculate_commission(total_cost)  # 0.4% broker + fees
       final_cost = total_cost + commission
       
       # Check user balance
       if request.user.virtual_balance < final_cost:
           return Response({'error': 'Insufficient balance'}, status=400)
       
       # Create Order
       order = Order.objects.create(
           user=request.user,
           stock=stock,
           order_type='BUY',
           quantity=quantity,
           price=current_price,
           status='EXECUTED'  # Paper trading = instant execution
       )
       
       # Create Transaction
       transaction = Transaction.objects.create(
           order=order,
           execution_price=current_price,
           commission=commission,
           total_amount=final_cost,
           executed_at=now()
       )
       
       # Update user balance
       request.user.virtual_balance -= final_cost
       request.user.save()
       
       # Update or create Holding
       holding, created = Holding.objects.get_or_create(
           user=request.user,
           stock=stock,
           defaults={'quantity': 0, 'average_buy_price': 0}
       )
       
       # Recalculate average buy price
       total_qty = holding.quantity + quantity
       total_investment = (holding.quantity * holding.average_buy_price) + total_cost
       holding.average_buy_price = total_investment / total_qty
       holding.quantity = total_qty
       holding.save()
       
       return Response({'message': 'Order executed', 'transaction_id': transaction.id})
Sell Order Flow:

Similar to buy, but:

Check user has sufficient quantity in holdings
Reduce holding quantity
Add sale proceeds to user balance
Calculate profit/loss vs average buy price




5.4 Portfolio Tracking
Real-time Portfolio Value:
python# API Endpoint: GET /api/portfolio/
def get_portfolio(request):
    holdings = Holding.objects.filter(user=request.user)
    
    portfolio_data = {
        'cash_balance': request.user.virtual_balance,
        'holdings': [],
        'total_invested': 0,
        'current_value': 0,
        'profit_loss': 0
    }
    
    for holding in holdings:
        # Get latest price for this stock
        latest_price = StockPrice.objects.filter(
            stock=holding.stock
        ).latest('timestamp').close
        
        current_value = holding.quantity * latest_price
        invested_value = holding.quantity * holding.average_buy_price
        profit_loss = current_value - invested_value
        
        portfolio_data['holdings'].append({
            'stock': holding.stock.symbol,
            'quantity': holding.quantity,
            'avg_buy_price': holding.average_buy_price,
            'current_price': latest_price,
            'current_value': current_value,
            'profit_loss': profit_loss,
            'profit_loss_percent': (profit_loss / invested_value) * 100
        })
        
        portfolio_data['total_invested'] += invested_value
        portfolio_data['current_value'] += current_value
    
    portfolio_data['profit_loss'] = portfolio_data['current_value'] - portfolio_data['total_invested']
    portfolio_data['total_value'] = portfolio_data['current_value'] + portfolio_data['cash_balance']
    
    return Response(portfolio_data)
Portfolio History (for charts):

Celery task runs daily: saves PortfolioSnapshot for each user
API returns time-series data for charting
TimescaleDB efficiently queries historical snapshots


5.5 Price Alerts System
Creating Alert:
python# User creates alert: "Notify me when NABIL goes above 1000"
PriceAlert.objects.create(
    user=request.user,
    stock=stock,
    target_price=1000,
    alert_type='ABOVE',
    is_active=True
)
Checking Alerts (Celery task runs every minute):
python@shared_task
def check_price_alerts_task():
    active_alerts = PriceAlert.objects.filter(is_active=True)
    
    for alert in active_alerts:
        current_price = StockPrice.objects.filter(
            stock=alert.stock
        ).latest('timestamp').close
        
        triggered = False
        if alert.alert_type == 'ABOVE' and current_price >= alert.target_price:
            triggered = True
        elif alert.alert_type == 'BELOW' and current_price <= alert.target_price:
            triggered = True
        
        if triggered:
            # Create notification
            Notification.objects.create(
                user=alert.user,
                message=f"{alert.stock.symbol} reached {current_price}",
                type='ALERT'
            )
            
            # Deactivate alert
            alert.is_active = False
            alert.triggered_at = now()
            alert.save()
Frontend displays notifications in real-time (polling every 30 seconds or WebSocket)

5.6 Calculators Implementation
All calculators are simple API endpoints that take input parameters and return calculations:
Commission Calculator:
python@api_view(['POST'])
def calculate_commission(request):
    amount = request.data['amount']
    
    broker_commission = amount * 0.004  # 0.4%
    sebon_fee = amount * 0.00015  # 0.015%
    dp_fee = 25  # Fixed
    
    total_commission = broker_commission + sebon_fee + dp_fee
    
    return Response({
        'broker_commission': broker_commission,
        'sebon_fee': sebon_fee,
        'dp_fee': dp_fee,
        'total_commission': total_commission,
        'total_cost': amount + total_commission
    })
Similar implementations for:

Dividend calculator (shares × dividend per share)
Bonus calculator (new shares based on bonus ratio)
Average cost calculator (given multiple purchases)
Break-even calculator (avg price + commission)

Frontend just calls these APIs and displays results.

5.7 Heatmap Implementation
Backend:
python# GET /api/stocks/heatmap/
def get_heatmap_data(request):
    stocks = Stock.objects.all()
    heatmap_data = []
    
    for stock in stocks:
        latest_price = StockPrice.objects.filter(
            stock=stock
        ).latest('timestamp')
        
        heatmap_data.append({
            'symbol': stock.symbol,
            'name': stock.name,
            'sector': stock.sector.name,
            'change_percent': latest_price.change_percent,
            'market_cap': stock.market_cap
        })
    
    return Response(heatmap_data)
Frontend (React):

Use library like react-d3-tree-map or custom implementation
Color stocks: green (positive), red (negative)
Size by market cap
Click to go to stock detail page


5.8 Search and Filter
Backend (Django filters):
python# GET /api/stocks/?sector=Banks&min_price=100&max_price=500&search=nabil
class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['sector']
    search_fields = ['symbol', 'name']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Add price filters
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        
        if min_price:
            # Join with latest price
            queryset = queryset.filter(...)
        
        return queryset
Frontend:

Filter dropdowns and search input
On change → update URL params → fetch filtered data


5.9 Admin Dashboard
Backend endpoints for admin:
python# Only accessible to admin users
@permission_classes([IsAdminUser])
class AdminAnalyticsView(APIView):
    def get(self, request):
        return Response({
            'total_users': CustomUser.objects.count(),
            'active_users': CustomUser.objects.filter(is_active=True).count(),
            'total_orders_today': Order.objects.filter(
                created_at__date=today()
            ).count(),
            'total_portfolio_value': sum_all_portfolio_values(),
            'data_fetch_status': get_last_fetch_status()
        })
Frontend React Admin Dashboard:

Stats cards showing key metrics
User list table with activate/deactivate actions
System health indicators
Data fetch logs


6. DEVELOPMENT WORKFLOW
Phase 1: Setup (Week 1-2)
Backend:

Install Django, DRF, PostgreSQL, TimescaleDB
Create Django project and apps structure
Configure database connections
Setup Celery + Redis
Install all required packages
Setup Git repository

Frontend:

Create React app with Vite
Install required libraries
Setup folder structure
Configure Axios with base URL
Setup React Router

Phase 2: Core Backend Development (Week 3-6)

Models & Database:

Define all Django models
Create migrations
Setup TimescaleDB hypertables
Seed initial data (sectors, dummy stocks)


Authentication:

Implement JWT authentication
Create register/login/logout endpoints
Test with Postman


Stock Data System:

Create ShareHub data fetching script
Setup Celery periodic task
Test data ingestion into TimescaleDB


Trading System:

Implement order placement logic
Implement


Continue7:31 PMbuy/sell execution

Test with different scenarios


Portfolio System:

Implement holdings tracking
Implement portfolio value calculation
Create historical snapshots


API Documentation:

Generate API docs with drf-spectacular
Document all endpoints



Phase 3: Core Frontend Development (Week 7-10)

Authentication UI:

Login and Register pages
AuthContext implementation
Protected routes


Dashboard:

Main dashboard layout
Portfolio summary components
Market overview widgets


Market Pages:

Stock list with filters
Stock detail page with charts
Heatmap visualization


Trading Pages:

Buy/Sell form
Order history table
Order validation and confirmation


Portfolio Pages:

Holdings display
Performance charts
Transaction history



Phase 4: Additional Features (Week 11-13)

Alerts System:

Backend alert checking
Frontend alert management UI
Notification display


Calculators:

All calculator APIs
Calculator UI with tabs


Admin Panel:

Admin-only routes
Analytics dashboard
User management



Phase 5: Testing & Refinement (Week 14-16)

Backend Testing:

Unit tests for models
API endpoint tests
Order execution edge cases


Frontend Testing:

Component testing
User flow testing
Cross-browser testing


Integration Testing:

Complete user journeys
Data consistency checks


Performance Optimization:

Database query optimization
Frontend bundle optimization
Caching implementation



Phase 6: Deployment Preparation (Week 17-18)

Backend Deployment:

Setup production settings
Configure environment variables
Database migration to production
Deploy to server (Heroku/Railway/DigitalOcean)


Frontend Deployment:

Build React for production
Configure Django to serve static files
OR deploy React separately (Vercel/Netlify)


Final Testing:

Test deployed version
Fix any production issues
Performance monitoring



Phase 7: Documentation (Week 19-20)

User manual
Technical documentation
API documentation
Presentation preparation


7. TOOLS & SOFTWARE YOU'LL USE
Development Tools:

Code Editor: VS Code (with extensions: Python, ES7 React snippets, Prettier)
API Testing: Postman or Thunder Client
Database Management: pgAdmin or DBeaver
Version Control: Git + GitHub
Terminal: Windows Terminal or iTerm2
Browser DevTools: Chrome DevTools

Services:

Database Hosting (Production): Railway, Heroku Postgres, or ElephantSQL
Backend Hosting: Railway, Heroku, or DigitalOcean
Frontend Hosting: Vercel, Netlify, or serve from Django
Redis Hosting (for Celery): Redis Cloud free tier


8. DATA FLOW EXAMPLES
Example 1: User Views Dashboard
1. User logs in → JWT token stored
2. React Dashboard.jsx mounts → useEffect triggers
3. Calls portfolioService.getPortfolio()
4. Axios sends GET /api/portfolio/ with Authorization header
5. Django validates JWT → fetches user's holdings
6. For each holding, gets latest price from StockPrice table
7. Calculates current values, P/L
8. Returns JSON response
9. React receives data → updates state → renders UI
Example 2: User Places Buy Order
1. User navigates to Stock Detail page (e.g., NABIL)
2. React fetches current price: GET /api/stocks/NABIL/current-price/
3. User clicks "Buy", enters quantity: 10
4. React calculates preview: price × 10 + commission
5. User confirms
6. React calls: POST /api/trading/orders/ {stock: 'NABIL', type: 'BUY', quantity: 10}
7. Django receives request → validates market hours
8. Gets current price from StockPrice table
9. Checks user balance (sufficient? ✓)
10. Creates Order and Transaction records
11. Updates user balance (-amount)
12. Updates/creates Holding record
13. Returns success response
14. React shows success message → redirects to portfolio
15. Portfolio refreshes → shows new holding
Example 3: Background Price Update
1. Celery beat triggers task: fetch_stock_prices_task (every 1 min)
2. Task checks: is_market_open() → True (it's 2 PM, market open)
3. Makes request to ShareHub Nepal API
4. Receives JSON with all stock prices
5. For each stock:
   - Gets Stock object by symbol
   - Creates new StockPrice entry in TimescaleDB
6. After all prices inserted:
   - Triggers check_price_alerts_task
7. Alert task fetches all active PriceAlerts
8. For each alert, compares target with current price
9. If triggered → creates Notification → deactivates alert
10. Next time user's React app polls /api/notifications/ → sees new alert

9. KEY CHALLENGES & SOLUTIONS
Challenge 1: Rate Limiting ShareHub Nepal
Solution:

Fetch data once per minute with Celery
Cache in database
Serve all user requests from database, not ShareHub

Challenge 2: Real-time Price Updates in React
Solution:

Option 1: Polling (fetch prices every 30-60 seconds)
Option 2: WebSocket with Django Channels (more complex but real-time)
For college project, polling is sufficient

Challenge 3: Accurate P/L Calculation
Solution:

Store average_buy_price in Holding model
Update it correctly with each buy (weighted average)
Calculate P/L: (current_price - avg_buy_price) × quantity

Challenge 4: Market Hours Enforcement
Solution:

Backend validates market hours on every order
Frontend shows "Market Closed" banner when outside hours
Check Nepal timezone (Asia/Kathmandu) properly

Challenge 5: Commission Calculation
Solution:

Research actual NEPSE charges (broker 0.4%, SEBON 0.015%, DP fee 25)
Create accurate calculator function
Apply to all transactions consistently


10. TESTING STRATEGY
Backend Testing:
python# Example test case
def test_buy_order_execution(self):
    user = create_test_user(balance=10000)
    stock = create_test_stock(symbol='TEST', price=100)
    
    response = self.client.post('/api/trading/orders/', {
        'stock_symbol': 'TEST',
        'order_type': 'BUY',
        'quantity': 10
    })
    
    self.assertEqual(response.status_code, 200)
    self.assertEqual(Order.objects.count(), 1)
    self.assertEqual(Transaction.objects.count(), 1)
    
    # Check balance deducted
    user.refresh_from_db()
    expected_balance = 10000 - (100 * 10) - commission
    self.assertEqual(user.virtual_balance, expected_balance)
Frontend Testing:

Manual testing of all user flows
Test different screen sizes (responsive design)
Test edge cases (negative balance, market closed, etc.)


SUMMARY
Your NEPSE Paper Trading System uses:

React → All UI, user interactions, data display
Django + DRF → All business logic, APIs, data processing
PostgreSQL → Structured data (users, stocks, orders, etc.)
TimescaleDB → Time-series data (price history, portfolio snapshots)
Celery + Redis → Background tasks (data fetching, alerts)
Axios → React-Django communication via REST APIs
JWT → Secure authentication
Recharts → Stock price charts
Material-UI → UI components and styling

The system lets users:

Practice trading with 1 million virtual rupees
View real NEPSE prices (1-min delay)
Place buy/sell orders instantly
Track portfolio with live P/L
Set price alerts
Use financial calculators
View market heatmaps and comparisons

Admins can:

Monitor all users and activity
Check system health
View platform analytics

This is a complete, production-ready architecture for your college project. Follow the phased development plan and you'll have a fully functional NEPSE paper trading platform in 20 weeks.
Does this detailed plan answer all your questions? Would you like me to elaborate on any specific component?