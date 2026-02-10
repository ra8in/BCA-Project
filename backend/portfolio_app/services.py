"""
Background service to check and execute pending limit orders.

Runs periodically during market hours to match pending orders
against current market prices.
"""

import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)


def execute_pending_orders():
    """
    Check all PENDING LIMIT orders and execute those that meet the price condition.
    
    - Buy Limit: Execute if current_price <= limit_price
    - Sell Limit: Execute if current_price >= limit_price
    
    Returns:
        dict: Summary of executed orders
    """
    from trading_app.models import Order, Transaction
    from portfolio_app.models import Holding
    
    pending_orders = Order.objects.filter(
        status='PENDING',
        order_mode='LIMIT'
    ).select_related('stock', 'user')
    
    if not pending_orders.exists():
        return {'checked': 0, 'executed': 0, 'failed': 0}
    
    executed = 0
    failed = 0
    total = pending_orders.count()
    
    print(f"🔍 Checking {total} pending limit orders...")
    
    for order in pending_orders:
        try:
            stock = order.stock
            current_price = stock.last_price
            
            if current_price is None:
                continue
            
            limit_price = order.price
            should_execute = False
            
            # Check execution condition
            if order.order_type == 'BUY':
                # Buy Limit: execute when price falls to limit or below
                if current_price <= limit_price:
                    should_execute = True
            elif order.order_type == 'SELL':
                # Sell Limit: execute when price rises to limit or above
                if current_price >= limit_price:
                    should_execute = True
            
            if not should_execute:
                continue
            
            # Execute the order
            if order.order_type == 'BUY':
                _execute_pending_buy(order, current_price)
            else:
                _execute_pending_sell(order, current_price)
            
            executed += 1
            print(f"  ✅ {order.order_type} {order.quantity} {stock.symbol} @ ₹{current_price} (limit: ₹{limit_price})")
            
        except Exception as e:
            failed += 1
            logger.error(f"Failed to execute pending order {order.id}: {e}")
            print(f"  ❌ Order {order.id} failed: {e}")
    
    summary = {'checked': total, 'executed': executed, 'failed': failed}
    
    if executed > 0:
        print(f"📊 Pending orders: {total} checked, {executed} executed, {failed} failed")
    
    return summary


def _execute_pending_buy(order, execution_price):
    """
    Execute a pending BUY limit order.
    Uses the same fee structure as BuyStockView.
    """
    from portfolio_app.models import Holding
    from trading_app.models import Transaction
    
    with transaction.atomic():
        user = order.user
        quantity = order.quantity
        stock = order.stock
        
        # Calculate costs (same as BuyStockView)
        amount = execution_price * quantity
        commission = max(Decimal('10'), amount * Decimal('0.004'))
        sebon_fee = amount * Decimal('0.00015')
        dp_fee = Decimal('25')
        total_fees = commission + sebon_fee + dp_fee
        total_cost = amount + total_fees
        effective_price = total_cost / quantity
        
        # Refresh user balance from DB
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.select_for_update().get(pk=user.pk)
        
        # Check balance
        if user.virtual_balance < total_cost:
            order.status = 'REJECTED'
            order.save()
            logger.warning(f"Order {order.id} rejected: Insufficient funds (need ₹{total_cost}, have ₹{user.virtual_balance})")
            return
        
        # Deduct balance
        user.virtual_balance -= total_cost
        user.save()
        
        # Update holding
        holding, created = Holding.objects.get_or_create(
            user=user,
            stock=stock,
            defaults={'quantity': 0, 'average_buy_price': Decimal('0')}
        )
        
        if not created:
            total_shares = holding.quantity + quantity
            total_cost_basis = (holding.average_buy_price * holding.quantity) + (effective_price * quantity)
            holding.average_buy_price = total_cost_basis / total_shares
            holding.quantity = total_shares
        else:
            holding.quantity = quantity
            holding.average_buy_price = effective_price
        
        holding.save()
        
        # Update order status
        order.status = 'EXECUTED'
        order.save()
        
        # Create transaction record
        Transaction.objects.create(
            user=user,
            stock=stock,
            order=order,
            transaction_type='BUY',
            quantity=quantity,
            price=execution_price,
            total_amount=amount,
            fees=total_fees,
            net_amount=total_cost,
            wacc_at_sell=None,
            realized_pl=None
        )


def _execute_pending_sell(order, execution_price):
    """
    Execute a pending SELL limit order.
    Uses the same fee structure as SellStockView.
    """
    from portfolio_app.models import Holding
    from trading_app.models import Transaction
    
    with transaction.atomic():
        user = order.user
        quantity = order.quantity
        stock = order.stock
        
        # Refresh user from DB
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.select_for_update().get(pk=user.pk)
        
        # Check holding still exists
        try:
            holding = Holding.objects.get(user=user, stock=stock)
        except Holding.DoesNotExist:
            order.status = 'REJECTED'
            order.save()
            logger.warning(f"Order {order.id} rejected: No holding found for {stock.symbol}")
            return
        
        if holding.quantity < quantity:
            order.status = 'REJECTED'
            order.save()
            logger.warning(f"Order {order.id} rejected: Insufficient shares ({holding.quantity} < {quantity})")
            return
        
        # Calculate fees (same as SellStockView)
        gross_amount = execution_price * quantity
        commission = max(Decimal('10'), gross_amount * Decimal('0.004'))
        sebon_fee = gross_amount * Decimal('0.00015')
        dp_fee = Decimal('25')
        
        # CGT: 5% of profit
        wacc = holding.average_buy_price
        cost_basis = wacc * quantity
        gross_profit = gross_amount - cost_basis
        
        cgt = Decimal('0')
        if gross_profit > 0:
            cgt = gross_profit * Decimal('0.05')
        
        total_deductions = commission + sebon_fee + dp_fee + cgt
        net_proceeds = gross_amount - total_deductions
        
        # Update balance
        user.virtual_balance += net_proceeds
        user.save()
        
        # Update holding
        remaining_qty = holding.quantity - quantity
        if remaining_qty == 0:
            holding.delete()
        else:
            holding.quantity = remaining_qty
            holding.save()
        
        # Update order
        order.status = 'EXECUTED'
        order.save()
        
        # Realized P/L
        realized_pl = net_proceeds - cost_basis
        
        # Create transaction record
        Transaction.objects.create(
            user=user,
            stock=stock,
            order=order,
            transaction_type='SELL',
            quantity=quantity,
            price=execution_price,
            total_amount=gross_amount,
            fees=total_deductions,
            net_amount=net_proceeds,
            wacc_at_sell=wacc,
            realized_pl=realized_pl
        )
