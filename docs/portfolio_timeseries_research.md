# Portfolio Timeseries Data Research & Analysis
## UPDATED: NEPSE Trading Modes Analysis

## Executive Summary

This research document analyzes portfolio timeseries requirements for your NEPSE paper trading system with TWO TRADING MODES:
1. **NEPSE Normal Mode** (Delivery Trading) - T+2 settlement, long-term holdings
2. **NEPSE Intraday Mode** - Same-day buy/sell of owned shares (NO short selling in Nepal)

Covers data granularity decisions, missing business logic, and implementation strategy for both modes.

---

## 🔴 CRITICAL CLARIFICATIONS (Addressing Your Comments)

### Your Comment #1: "System fetches data and stores in DB, data used for users"
**Understood**: You have a centralized stock price database. All users share the same `StockPrice` timeseries data (fetched from ShareHub Nepal). This is CORRECT architecture.

**What I meant by "data bloat"**: I was referring to creating 5-minute **portfolio snapshots** (not stock prices). With your clarification, here's the revised understanding:

| Data Type | Granularity | Storage | Who Uses |
|-----------|-------------|---------|----------|
| **Stock Prices** (StockPrice table) | Every minute during market hours | Centralized (1 copy) | All users share |
| **Portfolio Snapshots** (PortfolioSnapshot table) | TBD (this research) | Per-user | Individual users |

✅ **Stock price 5-minute data**: Fine if you're already fetching
❌ **Portfolio snapshot 5-minute data**: Still unnecessary (discussed below)

### Your Comment #2: "We are not providing charts, no problem"
**Question**: Are you skipping **all** portfolio charts, or just some?

**Impact on timeseries need**:
- ✅ If NO charts at all → You can skip `PortfolioSnapshot` entirely (just show current value)
- ⚠️ If charts in future → Keep `PortfolioSnapshot` infrastructure

**Recommendation**: Even without charts NOW, implement transaction-based snapshots (minimal effort) to have data READY when you add charts later. It's easier than reconstructing history.

### Your Comment #3: Portfolio Snapshot Strategy
**Your Idea**: "When user buys, fetch past data in background and add to server, use new data for this. Also do daily fetch if no trade."

**Translation**: Hybrid approach with smart optimization:
```python
# On Buy/Sell Transaction:
1. Create portfolio snapshot immediately (current value)
2. Background job: Backfill missing snapshots (fill gaps in history)

# Daily Job:
- If user has holdings AND no snapshots today → Create one
```

**My Response**: ✅ **EXCELLENT IDEA!** This is actually better than my suggestion. Here's why:

**Benefits**:
- First-time user trades → Instant snapshot + backfill creates full chart
- Active traders → Snapshots created naturally through trades
- Inactive holders → Daily job captures passive price changes
- No redundant snapshots (check "if no snapshots today")

**Implementation** (see updated code section below)

### Your Comment #4: "Why UnsettledHolding model??"
**Short Answer**: To prevent users from selling shares they bought today (NEPSE T+2 rule).

**Without UnsettledHolding model**:
```python
# BAD: User can sell immediately
Day 1: Buy 100 NABIL → Holding.quantity = 100
Day 1 (1 hour later): Sell 100 NABIL → SUCCESS (WRONG! Shares not settled yet)
```

**With UnsettledHolding model**:
```python
# GOOD: Tracks settlement status
Day 1: Buy 100 NABIL → Holding.quantity = 100, UnsettledHolding(100, settles Day 3)
Day 1: Try sell 100 NABIL → ERROR: "0 shares available (100 unsettled until Day 3)"
Day 3: Settlement job runs → UnsettledHolding marked settled
Day 3: Sell 100 NABIL → SUCCESS
```

**Alternative Without New Model** (if you prefer simpler approach):
Add fields to `Holding` model instead:
```python
class Holding(models.Model):
    # existing fields...
    settled_quantity = models.PositiveIntegerField(default=0)
    unsettled_quantity = models.PositiveIntegerField(default=0)
    # Total quantity = settled + unsettled
```

**Pros/Cons**:
- ✅ Simpler (no new model)
- ❌ Harder to track WHICH purchases settle WHEN (if user buys on multiple days)
- ❌ Can't show "30 shares settle tomorrow, 20 settle day after"

**My Recommendation**: If you want **realistic demo**, use `UnsettledHolding`. If you want **simple MVP**, use settled/unsettled fields in `Holding`.

### Your Comment #5: "Add two modes: NEPSE normal mode and intraday mode"
**Response**: ✅ **EXCELLENT FEATURE!** This is actually how real NEPSE works. Full analysis below.

---

## 1. NEPSE TRADING MODES: Complete Analysis

###  1.1 Understanding NEPSE Trading Modes

Based on research, NEPSE supports TWO trading modes (similar to India's NSE/BSE):

| Feature | **Normal Mode** (Delivery Trading) | **Intraday Mode** |
|---------|-----------------------------------|-------------------|
| **Purpose** | Long-term investment| Short-term profit from price fluctuations |
| **Holding Period** | Days/weeks/months/years | Same trading day only |
| **Settlement** | T+2 (shares credited to Demat in 2 days) | No delivery (squared off same day) |
| **Ownership Transfer** | YES - shares go to Demat account | NO - no actual ownership transfer |
| **Can Sell Immediately?** | NO - must wait T+2 settlement | YES - but only shares already owned |
| **Short Selling** | Not allowed in NEPSE | Not allowed in NEPSE |
| **Capital Required** | Full payment upfront | Can use margin/leverage (less capital) |
| **Fees** | Higher STT, full brokerage | Lower fees |
| **Risk** | Lower (long-term strategy) | Higher (volatile, leverage) |

> [!IMPORTANT]
> **CRITICAL NEPSE DIFFERENCE**: Unlike India's markets, **NEPSE does NOT allow short selling**. This means:
> - You CANNOT sell shares you don't own (even intraday)
> - "Intraday trading" in NEPSE = buying/selling shares you ALREADY OWN within same day
> - True intraday (buy → sell same stock same day) requires existing holdings

### 1.2 How Intraday Works in NEPSE (Key Difference from India/US)

**India/US Intraday**:
```python
# Can short sell (sell first, buy later)
11:00 AM: Sell 100 NABIL at ₹870 (you don't own any)
02:00 PM: Buy 100 NABIL at ₹850 (square off)
Profit: (870-850) × 100 = ₹2,000
```

**NEPSE "Intraday"** (No short selling!):
```python
# Option 1: Buy then sell same day (TRUE intraday)
11:00 AM: Buy 100 NABIL at ₹850
02:00 PM: Sell 100 NABIL at ₹870
Profit: (870-850) × 100 = ₹2,000
Settlement: Squared off - no delivery, funds credited T+1

# Option 2: Sell existing holdings, buy back (pseudo-intraday)
Already own: 100 NABIL (settled from previous trade)
11:00 AM: Sell 100 NABIL at ₹870
02:00 PM: Buy 100 NABIL at ₹850
Profit: (870-850) × 100 = ₹2,000
Settlement: Squared off - no net delivery change
```

### 1.3 Settlement Rules by Mode

#### Normal Mode (Delivery)
```python
Trade Day (T): Monday, 11:30 AM - Buy 100 NABIL
T+1: Tuesday - Clearing, e-DIS processing
T+2: Wednesday - Shares credited to Demat, sellable NEXT trading day?

# Portfolio Impact:
# Monday: Holding shows 100 NABIL (unsettled)
# Tuesday: Still unsettled
# Wednesday: Shares credited to Demat (usually by end of day)
# Thursday: Available to sell (T+3 effectively for safe trading)
```

#### Intraday Mode
```python
Trade Day (T): Monday
11:00 AM: Buy 100 NABIL at ₹850 (intraday order)
02:00 PM: Sell 100 NABIL at ₹870 (square off)
Market Close: Trade settled, profit credited T+1

# Portfolio Impact:
# Monday: Holding not permanently affected (net change 0)
# Tuesday: Profit credited
```

### 1.4 Portfolio Tracking Differences

> [!CAUTION]
> **This is where complexity increases!** Your portfolio tracking MUST handle both modes differently.

| Aspect | Normal Mode | Intraday Mode |
|--------|-------------|---------------|
| **Holding Update** | Immediate (quantity++), but unsettled | No holding update (if squared off) |
| **Portfolio Snapshot** | After each trade (tracks unsettled) | Only if NOT squared off |
| **T+2 Settlement** | REQUIRED | NOT REQUIRED (if squared off) |
| **Sell Validation** | Check settled quantity | Check if position is open |

### 1.5 Implementation Strategy Recommendation

> [!NOTE]
> **Start with Normal Mode ONLY**, add Intraday as Phase 2.

**Why?**
1. ✅ Normal mode is simpler (you've already started)
2. ✅ More relevant for "paper trading" educational context
3. ✅ Intraday requires additional complexity (position tracking, auto-square-off)

---

## 2. Current State Analysis

### 1.1 Existing Models

#### Portfolio Models (Already Implemented)
- **`Holding`**: Tracks current stock ownership (user, stock, quantity, average_buy_price)
- **`PortfolioSnapshot`**: Stores historical portfolio value snapshots (user, timestamp, total_value, cash_balance, investment_value)
- **`WatchlistGroup`** & **`WatchlistItem`**: Watchlist management

#### Trading Models (Already Implemented)
- **`Order`**: Buy/sell orders with status tracking (PENDING, EXECUTED, CANCELLED, REJECTED)
- **`Transaction`**: Executed trades with financial details (price, fees, WACC, realized P/L)

#### Stock Models (Already Implemented)
- **`Stock`**: Company information with current price snapshot
- **`StockPrice`** (TimescaleDB hypertable): Historical stock prices with timestamp, OHLC, volume
- **`MarketIndex`**: NEPSE index tracking

### 1.2 Current API Endpoints (Portfolio App)
Based on `portfolio_app/views.py` analysis:
- ✅ `GET /api/portfolio/` - Portfolio summary with holdings
- ✅ `GET /api/portfolio/holdings/` - Current holdings list
- ✅ `POST /api/portfolio/buy/` - Buy stock
- ✅ `POST /api/portfolio/sell/` - Sell stock
- ✅ `GET /api/portfolio/history/` - Portfolio value history (`PortfolioSnapshot`)
- ✅ `GET /api/portfolio/past-holdings/` - Sold positions
- ✅ `GET /api/portfolio/transactions/{symbol}/` - Stock transaction history
- ✅ Watchlist CRUD operations

### 1.3 Data Already Using TimescaleDB
- `stocks_stockprice` - Stock price history (hypertable)
- `portfolio_portfoliosnapshot` - Portfolio value over time (likely intended as hypertable)
- `market_data_marketindex` - Index value history (hypertable)

---

## 3. Critical Missing Features: NEPSE Business Logic

### 2.1 NEPSE T+2 Settlement Cycle ⚠️ **CRITICAL GAP**

> [!IMPORTANT]
> **Current Issue**: Your system allows immediate re-selling of purchased stocks, which is **unrealistic** for NEPSE trading.

#### Real NEPSE Settlement Rules
Based on research, NEPSE operates on a **T+2 settlement cycle**:
- **Day T (Trade Date)**: User places buy order
- **Day T+1**: Broker clearing, e-DIS processing
- **Day T+2**: Shares credited to buyer's Demat account
- **Availability**: Typically sellable on T+3 (or effectively late T+2, but safer to assume T+3/next trading day for simplicity).

**Holding Period Restriction**: Shares cannot be sold until **settlement is complete**.

#### What You're Missing
```python
# ❌ Current behavior (WRONG)
Day 1: Buy NABIL
Day 1: Sell NABIL (ALLOWED!)

# ✅ Correct NEPSE behavior
Day 1 (Monday): Buy NABIL
Day 2 (Tuesday): T+1 (wait)
Day 3 (Wednesday): T+2 (Settlement Day - shares arrive)
Day 4 (Thursday): Available to Sell (Safest assumption)
# OR available late Wednesday depending on broker speed
```

#### Impact on Demo
For college demonstration, **this is a critical demo-killer** if not implemented:
- **Professor Question**: "Why can students sell shares immediately?"
- **Realism**: Paper trading should mimic real rules
- **Complexity**: Adds educational value

### 2.2 Trading Hours Validation

NEPSE Trading Hours: **Sunday-Friday, 11:00 AM - 3:00 PM Nepal Time**

Your system should:
- ✅ Allow orders during trading hours
- ✅ Queue or reject orders outside trading hours

---

## 4. Do You Need Timeseries Data for Portfolio?

### 3.1 Current Implementation Assessment

**Already Have:**
- ✅ `PortfolioSnapshot` model for historical portfolio value
- ✅ Endpoint to fetch portfolio history: `GET /api/portfolio/history/`
- ✅ Frontend service method: `portfolioService.getHistory()`

**Analysis**: You **already have timeseries infrastructure** for portfolio! The `PortfolioSnapshot` table tracks portfolio value over time.

### 3.2 What's Currently Missing

#### A. Portfolio Snapshot Creation Logic
**Question**: How and when are `PortfolioSnapshot` records created?

Current options:
1. **Celery periodic task**: Daily snapshot at market close
2. **On-demand**: Create snapshot after each transaction
3. **Hybrid**: Daily snapshots + snapshots on significant events

**Recommendation for Demo**:
```python
# Option: Create snapshot on every transaction
# Pros: Real-time portfolio history, impressive for demo
# Cons: More database writes, but TimescaleDB handles this well

# Implementation in views.py (add after buy/sell transaction)
def create_portfolio_snapshot(user):
    # calculate total value
    PortfolioSnapshot.objects.create(...)
```

#### B. Portfolio Timeseries Charts (Frontend)
**Current**: Frontend calls `getHistory()` but needs chart implementation.
**Need**: Portfolio value chart over time (line chart).

---

## 5. Data Granularity: 5-Minute vs Daily vs Transactional

### 4.1 Analysis for College Demo Context

> [!WARNING]
> **5-minute granularity for portfolio is OVERKILL for a college project.**

| Granularity | Storage Needs | Complexity | Demo Value | Recommendation |
|-------------|---------------|------------|------------|----------------|
| **5-minute intervals** | ~75 snapshots/day × users | HIGH | LOW | ❌ **Avoid** |
| **Daily snapshots** | 1 snapshot/day × users | LOW | MEDIUM | ⚠️ **OK for basics** |
| **Transaction-based** | N snapshots (N = transactions) | MEDIUM | **HIGH** | ✅ **BEST for demo** |
| **Hybrid** (daily + transactions) | Variable | MEDIUM | **HIGH** | ✅ **IDEAL** |

### 4.2 Detailed Comparison

#### Option 1: 5-Minute Granularity ❌
**Use Case**: High-frequency trading
**Cons**: Massive complexity, data bloat, low demo value (few trades in class).

#### Option 2: Daily Snapshots ⚠️
**Use Case**: Long-term tracking
**Cons**: If demo is 1 day long, you get 1 data point (no chart).

#### Option 3: Transaction-Based Snapshots ✅ **BEST**
**Use Case**: Track value after every trade
**Implementation**:
```python
# In BuyStockView.post() and SellStockView.post():
create_portfolio_snapshot(request.user)
```
**Pros**: Perfect for demo charts, realistic impact visualization.

#### Option 4: Hybrid Approach (Transaction + Daily) ✅ **IDEAL**
**Implementation**:
1. Create snapshot on every trade.
2. Run daily Celery task to fill gaps for inactive users.
**Pros**: Complete history, best of both worlds.

---

## 6. Implementation Recommendation

### 5.1 Database Schema Changes

#### Add Unsettled Holdings Tracking

```python
# portfolio_app/models.py
class UnsettledHolding(models.Model):
    """Tracks shares purchased but not yet settled (T+2)."""
    user = models.ForeignKey(User, ...)
    stock = models.ForeignKey(Stock, ...)
    transaction = models.OneToOneField(Transaction, ...)
    quantity = models.PositiveIntegerField()
    purchase_date = models.DateField()
    settlement_date = models.DateField()  # T+2 date
    is_settled = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['settlement_date']
```

**Recommendation**: Use `UnsettledHolding` model - explicit and clean.

### 5.2 Business Logic Changes

#### A. Settlement Date Calculation
```python
# utils/settlement.py
def calculate_settlement_date(trade_date):
    """Calculate T+2 settlement date (skip Saturday)."""
    # ... logic ...
    return settlement_date
```

#### B. Buy Logic Changes
```python
# Create Transaction
# Create UnsettledHolding (settlement_date = T+2)
# Create PortfolioSnapshot
```

#### C. Sell Logic Changes - **CRITICAL VALIDATION**
```python
# Check UnsettledHolding vs Holding
# Allow sell ONLY if settled_qty >= sell_qty
# Else return Error with settlement info
```

#### D. Settlement Background Task
```python
# Daily task (celery)
# Find UnsettledHolding where settlement_date <= today
# Mark is_settled = True
# (Logic to move to Holding if separate, or just flag)
```

---

## 7. Recommendations Summary

### Immediate Next Steps (For Demo Readiness)

1. **Implement T+2 Settlement Logic** (Critical)
   - Create `UnsettledHolding` model
   - Update Buy/Sell views
   - Add background settlement task

2. **Implement Transaction-based Portfolio Snapshots** (High)
   - Create snapshot utility
   - Integrate into Buy/Sell views

3. **Frontend Display** (Medium)
   - Show "Settled" vs "Unsettled" holdings
   - Show simple portfolio value chart

**Do NOT implement:**
- 5-minute portfolio snapshots (Overkill)
- Intraday mode (unless Extra Credit / Phase 2)

### Final Answer on Timeseries
**YES**, you need timeseries data, but **transaction-based snapshots** are sufficient and best for your project. You already have the `PortfolioSnapshot` table, just need to populate it correctly.

---

## 8. Code Examples: Complete Implementation

### 8.1 New Model: UnsettledHolding

```python
# portfolio_app/models.py

class UnsettledHolding(models.Model):
    """
    Tracks shares purchased but not yet settled (T+2).
    Prevents selling shares before settlement.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='unsettled_holdings'
    )
    stock = models.ForeignKey(
        'stocks_app.Stock', 
        on_delete=models.CASCADE,
        related_name='unsettled_holdings'
    )
    transaction = models.OneToOneField(
        'trading_app.Transaction',
        on_delete=models.CASCADE,
        related_name='unsettled_holding'
    )
    quantity = models.PositiveIntegerField()
    purchase_date = models.DateField()
    settlement_date = models.DateField(
        help_text="T+2 settlement date (when shares become tradeable)"
    )
    is_settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['settlement_date']
        indexes = [
            models.Index(fields=['user', 'is_settled']),
            models.Index(fields=['settlement_date', 'is_settled']),
        ]
    
    def __str__(self):
        status = "Settled" if self.is_settled else f"Settles on {self.settlement_date}"
        return f"{self.user.username} - {self.stock.symbol} ({self.quantity} shares, {status})"
    
    @property
    def days_until_settlement(self):
        """Calculate days remaining until settlement."""
        if self.is_settled:
            return 0
        from django.utils import timezone
        today = timezone.now().date()
        delta = (self.settlement_date - today).days
        return max(0, delta)
```

### 8.2 Utility Functions

```python
# portfolio_app/utils.py

from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from .models import Holding, PortfolioSnapshot, UnsettledHolding

def calculate_settlement_date(trade_datetime):
    """
    Calculate T+2 settlement date for NEPSE.
    NEPSE trading days: Sunday-Friday (Saturday closed)
    
    Args:
        trade_datetime: datetime object of trade execution
    
    Returns:
        date object representing settlement date (T+2)
    """
    settlement_date = trade_datetime.date()
    business_days_added = 0
    
    while business_days_added < 2:
        settlement_date += timedelta(days=1)
        # Skip Saturday (weekday() == 5, where Monday=0)
        if settlement_date.weekday() != 5:
            business_days_added += 1
    
    return settlement_date


def get_available_sell_quantity(user, stock):
    """
    Calculate how many shares user can sell (settled shares only).
    
    Args:
        user: User instance
        stock: Stock instance
    
    Returns:
        dict with total, settled, unsettled quantities
    """
    holding = Holding.objects.filter(user=user, stock=stock).first()
    
    if not holding:
        return {
            'total': 0,
            'settled': 0,
            'unsettled': 0,
            'can_sell': 0
        }
    
    # Calculate unsettled quantity
    unsettled_qty = UnsettledHolding.objects.filter(
        user=user,
        stock=stock,
        is_settled=False
    ).aggregate(total=Sum('quantity'))['total'] or 0
    
    settled_qty = holding.quantity - unsettled_qty
    
    return {
        'total': holding.quantity,
        'settled': settled_qty,
        'unsettled': unsettled_qty,
        'can_sell': settled_qty
    }


def create_portfolio_snapshot(user):
    """
    Create a portfolio snapshot for the user at current time.
    Calculates total value based on current holdings and stock prices.
    
    Args:
        user: User instance
    
    Returns:
        PortfolioSnapshot instance
    """
    # Calculate total investment value
    holdings = Holding.objects.filter(user=user).select_related('stock')
    total_investment_value = sum(
        holding.quantity * holding.stock.last_price 
        for holding in holdings
    )
    
    # Get cash balance (assuming User model has virtual_balance field)
    cash_balance = user.virtual_balance
    
    # Create snapshot
    snapshot = PortfolioSnapshot.objects.create(
        user=user,
        total_value=cash_balance + total_investment_value,
        cash_balance=cash_balance,
        investment_value=total_investment_value
    )
    
    return snapshot
```

### 8.3 Updated Buy View

```python
# portfolio_app/views.py

from .utils import calculate_settlement_date, create_portfolio_snapshot

class BuyStockView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # ... (existing validation logic) ...
        
        with transaction.atomic():
            # Create transaction record
            txn = Transaction.objects.create(
                user=request.user,
                stock=stock,
                transaction_type='BUY',
                quantity=quantity,
                price=execution_price,
                total_amount=total_amount,
                fees=total_fees,
                net_amount=net_amount,
            )
            
            # Create unsettled holding (NEW)
            settlement_date = calculate_settlement_date(timezone.now())
            UnsettledHolding.objects.create(
                user=request.user,
                stock=stock,
                transaction=txn,
                quantity=quantity,
                purchase_date=timezone.now().date(),
                settlement_date=settlement_date,
                is_settled=False
            )
            
            # Update or create main holding
            holding, created = Holding.objects.get_or_create(
                user=request.user,
                stock=stock,
                defaults={'quantity': 0, 'average_buy_price': 0}
            )
            
            # Calculate new WACC
            old_total_cost = holding.quantity * holding.average_buy_price
            new_total_cost = old_total_cost + (quantity * execution_price)
            new_total_quantity = holding.quantity + quantity
            new_wacc = new_total_cost / new_total_quantity
            
            holding.quantity = new_total_quantity
            holding.average_buy_price = new_wacc
            holding.save()
            
            # Deduct from user balance
            request.user.virtual_balance -= net_amount
            request.user.save()
            
            # Create portfolio snapshot (NEW)
            create_portfolio_snapshot(request.user)
            
            return Response({
                'success': True,
                'message': f'Bought {quantity} shares of {symbol}',
                'transaction_id': txn.id,
                'settlement_date': settlement_date.isoformat(),
                'settlement_info': f'Shares will be available to sell on {settlement_date.strftime("%Y-%m-%d")} (T+2)'
            }, status=status.HTTP_201_CREATED)
```

### 8.4 Updated Sell View with Settlement Validation

```python
# portfolio_app/views.py

from django.db.models import Sum
from .utils import get_available_sell_quantity, create_portfolio_snapshot

class SellStockView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        symbol = request.data.get('symbol')
        quantity = int(request.data.get('quantity', 0))
        
        # Get stock
        try:
            stock = Stock.objects.get(symbol=symbol)
        except Stock.DoesNotExist:
            return Response({'error': 'Stock not found'}, status=404)
        
        # Get holding
        try:
            holding = Holding.objects.get(user=request.user, stock=stock)
        except Holding.DoesNotExist:
            return Response({'error': 'You do not own this stock'}, status=400)
        
        # Check available quantity (CRITICAL: Settlement validation)
        availability = get_available_sell_quantity(request.user, stock)
        
        if quantity > availability['can_sell']:
            # Get unsettled holdings details for error message
            unsettled_details = UnsettledHolding.objects.filter(
                user=request.user,
                stock=stock,
                is_settled=False
            ).values('quantity', 'purchase_date', 'settlement_date')
            
            return Response({
                'error': 'Insufficient settled shares available to sell',
                'requested_quantity': quantity,
                'total_shares': availability['total'],
                'settled_shares': availability['settled'],
                'unsettled_shares': availability['unsettled'],
                'max_sell_quantity': availability['can_sell'],
                'unsettled_holdings': list(unsettled_details),
                'info': 'Shares must be settled (T+2) before they can be sold'
            }, status=400)
        
        # Proceed with sell (quantity validation passed)
        with transaction.atomic():
            execution_price = stock.last_price
            # ... (existing sell logic: calculate fees, create transaction, etc.) ...
            
            # Update holding
            holding.quantity -= quantity
            if holding.quantity == 0:
                holding.delete()
            else:
                holding.save()
            
            # Add to user balance
            request.user.virtual_balance += net_amount
            request.user.save()
            
            # Create portfolio snapshot (NEW)
            create_portfolio_snapshot(request.user)
            
            return Response({
                'success': True,
                'message': f'Sold {quantity} shares of {symbol}',
                # ... other response data ...
            }, status=status.HTTP_200_OK)
```

### 8.5 Settlement Background Task

```python
# market_data_app/tasks.py

from celery import shared_task
from django.utils import timezone
from django.db.models import Q
from portfolio_app.models import UnsettledHolding
import logging

logger = logging.getLogger(__name__)

@shared_task
def settle_holdings_task():
    """
    Daily task to settle holdings that have reached T+2 settlement date.
    Should run daily after market close (e.g., 4:00 PM) or before market open.
    """
    today = timezone.now().date()
    
    # Find all unsettled holdings that should be settled today
    to_settle = UnsettledHolding.objects.filter(
        settlement_date__lte=today,
        is_settled=False
    )
    
    settled_count = 0
    for unsettled in to_settle:
        unsettled.is_settled = True
        unsettled.save()
        settled_count += 1
        
        logger.info(
            f"Settled {unsettled.quantity} shares of {unsettled.stock.symbol} "
            f"for user {unsettled.user.username}"
        )
    
    logger.info(f"Settlement task completed: {settled_count} holdings settled")
    return {
        'settled_count': settled_count,
        'settlement_date': today.isoformat()
    }

# Schedule in celery beat config:
# CELERY_BEAT_SCHEDULE = {
#     'settle-holdings-daily': {
#         'task': 'market_data_app.tasks.settle_holdings_task',
#         'schedule': crontab(hour=16, minute=0, day_of_week='0-4'),  # 4 PM, Sun-Thu
#     },
# }
```

---

## 9. Demo Preparation Strategy

### 9.1 Seed Data for Impressive Demo

```python
# scripts/seed_demo_portfolio.py

from django.utils import timezone
from datetime import timedelta
from users_app.models import CustomUser
from stocks_app.models import Stock
from trading_app.models import Transaction
from portfolio_app.models import Holding, PortfolioSnapshot
from portfolio_app.utils import create_portfolio_snapshot

def seed_demo_portfolio():
    """
    Create realistic demo data for portfolio demonstration.
    Creates 7 days of trading history for demo user.
    """
    # Get or create demo user
    user, _ = CustomUser.objects.get_or_create(
        username='demo_student',
        defaults={'virtual_balance': 1000000}
    )
    
    # Get some stocks
    stocks = Stock.objects.filter(symbol__in=['NABIL', 'NICA', 'ADBL'])[:3]
    
    if not stocks.exists():
        print("Error: No stocks found. Run seed_stocks.py first.")
        return
    
    # Create transactions over 7 days
    base_date = timezone.now() - timedelta(days=7)
    
    transactions = [
        # Day 1: Buy NABIL
        {'day': 0, 'stock': stocks[0], 'type': 'BUY', 'qty': 50, 'price': 850},
        # Day 2: Buy NICA
        {'day': 1, 'stock': stocks[1], 'type': 'BUY', 'qty': 100, 'price': 650},
        # Day 4: Sell some NABIL (after T+2 settlement)
        {'day': 3, 'stock': stocks[0], 'type': 'SELL', 'qty': 20, 'price': 870},
        # Day 5: Buy ADBL
        {'day': 4, 'stock': stocks[2], 'type': 'BUY', 'qty': 75, 'price': 450},
        # Day 7: Sell more NABIL
        {'day': 6, 'stock': stocks[0], 'type': 'SELL', 'qty': 15, 'price': 865},
    ]
    
    for txn_data in transactions:
        txn_date = base_date + timedelta(days=txn_data['day'])
        # Create transaction, update holdings, create snapshot
        # (use your existing buy/sell logic or simplified version)
        create_portfolio_snapshot(user)  # Create snapshot after each transaction
    
    print(f"Demo portfolio created for user: {user.username}")
    print(f"Portfolio snapshots: {PortfolioSnapshot.objects.filter(user=user).count()}")
```

### 9.2 Class Demonstration Script

**Demo Flow (5-10 minutes)**:

1. **Login as demo user** → Show dashboard with portfolio chart (7 days of data)
2. **Attempt to buy stock** → Success, show unsettled shares badge
3. **Immediately try to sell** → Error message explaining T+2 settlement
4. **Show holdings breakdown**: Total vs Settled vs Unsettled
5. **Fast-forward time (manually or via admin)** → Mark settlement as complete
6. **Retry sell** → Success, show portfolio value update in real-time
7. **Show portfolio history chart** → Highlight transaction-based data points

**Professor Questions You'll Ace**:
- ❓ "Why can't I sell immediately?" → **T+2 settlement explanation**
- ❓ "How does this differ from real trading?" → **Explain NEPSE rules implemented**
- ❓ "How do you track portfolio over time?" → **Show TimescaleDB + snapshots**
- ❓ "What if market is closed?" → **Trading hours validation**

---

## 10. Conclusion & Action Plan

### Final Recommendations

| Question | Answer |
|----------|--------|
| **Do we need timeseries for portfolio?** | ✅ **YES** - Already have infrastructure, need to populate it |
| **Do we need 5-minute data?** | ❌ **NO** - Overkill for paper trading demo |
| **What granularity?** | ✅ **Transaction-based** (+ optional daily) |
| **Missing critical logic?** | ⚠️ **T+2 settlement** - **MUST IMPLEMENT** |
| **Demo complexity?** | 🎯 **Medium** - Impressive but achievable |

### Implementation Priority

```markdown
## Week 1: Core Settlement Logic
- [ ] Create UnsettledHolding model + migrations
- [ ] Implement calculate_settlement_date() utility
- [ ] Update BuyStockView to create unsettled holdings
- [ ] Update SellStockView with settlement validation
- [ ] Add unit tests for settlement logic

## Week 2: Portfolio Snapshots
- [ ] Implement create_portfolio_snapshot() utility
- [ ] Integrate snapshot creation in buy/sell views
- [ ] Add settle_holdings_task() (Celery)
- [ ] Test portfolio history API endpoint

## Week 3: Frontend & Demo
- [ ] Update portfolio serializers (settlement info)
- [ ] Add unsettled shares UI display
- [ ] Implement portfolio value chart (Recharts)
- [ ] Create demo seed data script
- [ ] Test complete demo flow

## Week 4: Polish & Testing
- [ ] Add helpful error messages
- [ ] Create demo walkthrough document
- [ ] Practice presentation (5-10 min)
- [ ] Prepare for Q&A scenarios
```

### Success Metrics for Demo

✅ **Must Have**:
- T+2 settlement prevents immediate re-selling
- Portfolio history chart displays properly
- Error messages are clear and educational

✅ **Nice to Have**:
- Real-time portfolio value updates
- Unsettled holdings countdown timer
- Performance metrics (profit/loss over time)

✅ **Bonus Points**:
- Trading hours enforcement
- Mobile-responsive portfolio charts
- Detailed transaction history with settlement tracking

---

**Next Steps**: Review this research with your team → Decide on implementation scope → Start with Phase 1 (Settlement Logic)
