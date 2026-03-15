from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import Holding, PortfolioSnapshot, WatchlistGroup, WatchlistItem
from .serializers import (
    HoldingSerializer, PortfolioSummarySerializer, PortfolioSnapshotSerializer, 
    OrderSerializer, WatchlistGroupSerializer, WatchlistItemSerializer
)
from stocks_app.models import Stock
from stocks_app.tasks import trigger_market_data_update
from stocks_app.market_hours import is_market_open
from trading_app.models import Order, Transaction


class WatchlistGroupViewSet(viewsets.ModelViewSet):
    """CRUD for watchlist groups."""
    serializer_class = WatchlistGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WatchlistGroup.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WatchlistItemViewSet(viewsets.ModelViewSet):
    """CRUD for items within a watchlist group."""
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WatchlistItem.objects.filter(group__user=self.request.user).select_related('stock', 'group')
        # Filter by group
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        # Filter by stock (to check if stock is in any watchlist)
        stock_id = self.request.query_params.get('stock')
        if stock_id:
            queryset = queryset.filter(stock_id=stock_id)
        return queryset

class OrderHistoryView(generics.ListAPIView):
    """Get active or past orders"""
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        status_filter = self.request.query_params.get('status') # 'active' or 'history'
        
        if status_filter == 'active':
            # PENDING orders are active
            return Order.objects.filter(user=user, status='PENDING').order_by('-created_at')
        else:
            # All other statuses are history
            return Order.objects.filter(user=user).exclude(status='PENDING').order_by('-created_at')


class PortfolioView(APIView):
    """Get complete portfolio with summary and holdings"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        holdings = Holding.objects.filter(user=user).select_related('stock')
        
        # Calculate summary
        cash_balance = user.virtual_balance
        invested_amount = Decimal('0')
        current_value = Decimal('0')
        
        for holding in holdings:
            cost = holding.average_buy_price * holding.quantity
            invested_amount += cost
            current_price = holding.stock.last_price or holding.average_buy_price
            current_value += current_price * holding.quantity
        
        total_profit_loss = current_value - invested_amount
        total_profit_loss_percent = (total_profit_loss / invested_amount * 100) if invested_amount > 0 else Decimal('0')
        
        # Calculate Realized Profit/Loss from Transactions
        from django.db.models import Sum
        realized_data = Transaction.objects.filter(
            user=user, 
            transaction_type='SELL'
        ).aggregate(total=Sum('realized_pl'))
        total_realized_profit = realized_data['total'] or Decimal('0')
        
        serializer = PortfolioSummarySerializer({
            'cash_balance': cash_balance,
            'invested_amount': invested_amount,
            'current_value': current_value,
            'total_profit_loss': total_profit_loss,
            'total_realized_profit': total_realized_profit,
            'total_profit_loss_percent': total_profit_loss_percent,
            'holdings': holdings
        })
        
        return Response(serializer.data)


class HoldingsListView(generics.ListAPIView):
    """List all holdings for authenticated user"""
    serializer_class = HoldingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Holding.objects.filter(user=self.request.user).select_related('stock')



class BuyStockView(APIView):
    """Buy a stock"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Check if market is open for trading
        market_open, reason = is_market_open()
        if not market_open:
            return Response({
                'error': 'Market is closed',
                'reason': reason,
                'trading_hours': '11:00 AM - 3:00 PM (Sun-Thu)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            symbol = request.data.get('symbol')
            quantity = int(request.data.get('quantity', 0))
            order_type = request.data.get('type', 'MARKET').upper() # MARKET or LIMIT
            price_input = request.data.get('price')
            
            if not symbol or quantity <= 0:
                return Response({'error': 'Invalid symbol or quantity'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                stock = Stock.objects.get(symbol=symbol)
            except Stock.DoesNotExist:
                return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
                
            current_price = stock.last_price
            if current_price is None:
                 return Response({'error': 'Stock market price is unavailable'}, status=status.HTTP_400_BAD_REQUEST)

            # Limit Order Price Band Validation (±10% of Previous Close)
            if order_type == 'LIMIT' and price_input:
                try:
                    limit_price = Decimal(price_input)
                    # Use Previous Close as base price
                    base_price = stock.previous_close
                    if not base_price or base_price <= 0:
                        base_price = stock.last_price # Fallback
                    
                    if base_price and base_price > 0:
                        min_price = (base_price * Decimal('0.90')).quantize(Decimal('0.01'))
                        max_price = (base_price * Decimal('1.10')).quantize(Decimal('0.01'))
                        
                        if limit_price < min_price or limit_price > max_price:
                            return Response({
                                'error': f'Limit price must be within ±10% of previous close (Rs. {base_price})',
                                'range': f'Rs. {min_price} - Rs. {max_price}',
                                'details': 'Circuit Breaker Rule'
                            }, status=status.HTTP_400_BAD_REQUEST)
                except Exception:
                    pass
    
            # Start Atomic Transaction
            with transaction.atomic():
                # 1. Create Order Record
                order = Order.objects.create(
                    user=request.user,
                    stock=stock,
                    order_type='BUY',
                    order_mode=order_type,
                    quantity=quantity,
                    price=Decimal(price_input) if price_input else None,
                    status='PENDING'
                )
        
                should_execute = False
        
                # 2. Check Execution Condition
                if order_type == 'MARKET':
                    should_execute = True
                    execution_price = current_price
                elif order_type == 'LIMIT':
                    if not price_input:
                         return Response({'error': 'Price required for Limit Order'}, status=status.HTTP_400_BAD_REQUEST)
                    limit_price = Decimal(price_input)
                    # Buy Limit executes if current price is <= limit price
                    if current_price <= limit_price:
                        should_execute = True
                        execution_price = current_price # Execute at best available price (market)
                    else:
                        should_execute = False
                
                # 3. Handle Pending
                if not should_execute:
                    # Trigger price update even for pending orders!
                    trigger_market_data_update()
                    
                    return Response({
                        'message': f'Buy Limit Order placed for {quantity} {symbol} at Rs. {price_input}. Status: PENDING',
                        'order': {'id': order.id, 'status': 'PENDING'},
                        'new_balance': float(request.user.virtual_balance)
                    }, status=status.HTTP_201_CREATED)
        
                # 4. Execute Order
                amount = execution_price * quantity
                
                # Calculate fees
                commission = max(Decimal('10'), amount * Decimal('0.004'))
                sebon_fee = amount * Decimal('0.00015')
                dp_fee = Decimal('25')
                total_fees = commission + sebon_fee + dp_fee
                total_cost = amount + total_fees
                effective_price = total_cost / quantity
                
                user = request.user
                if user.virtual_balance < total_cost:
                    order.status = 'REJECTED'
                    order.save()
                    return Response({'error': 'Insufficient funds'}, status=status.HTTP_400_BAD_REQUEST)
                    
                user.virtual_balance -= total_cost
                user.save()
                
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
                
                # Update Order
                order.status = 'EXECUTED'
                order.save()
                
                # Create Transaction Record
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
            
            # Trigger async update of ALL stock prices in database
            trigger_market_data_update()
            
            return Response({
                'message': f'Successfully bought {quantity} shares of {symbol} at Rs. {execution_price}',
                'holding': HoldingSerializer(holding).data,
                'new_balance': float(user.virtual_balance)
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f"Processing Error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class SellStockView(APIView):
    """Sell a stock"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Check if market is open for trading
        market_open, reason = is_market_open()
        if not market_open:
            return Response({
                'error': 'Market is closed',
                'reason': reason,
                'trading_hours': '11:00 AM - 3:00 PM (Sun-Thu)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            symbol = request.data.get('symbol')
            quantity = int(request.data.get('quantity', 0))
            order_type = request.data.get('type', 'MARKET').upper()
            price_input = request.data.get('price')
            
            if not symbol or quantity <= 0:
                return Response({'error': 'Invalid symbol or quantity'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                stock = Stock.objects.get(symbol=symbol)
            except Stock.DoesNotExist:
                return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
            
            user = request.user
            
            # 1. Verification (Do they own it?)
            try:
                holding = Holding.objects.get(user=user, stock=stock)
            except Holding.DoesNotExist:
                return Response({'error': 'You do not own this stock'}, status=status.HTTP_400_BAD_REQUEST)
            
            if holding.quantity < quantity:
                return Response({'error': 'Insufficient shares'}, status=status.HTTP_400_BAD_REQUEST)
                
            current_price = stock.last_price
            if current_price is None:
                 return Response({'error': 'Stock market price is unavailable'}, status=status.HTTP_400_BAD_REQUEST)

            # Limit Order Price Band Validation (±10% of Previous Close)
            if order_type == 'LIMIT' and price_input:
                try:
                    limit_price = Decimal(price_input)
                    # Use Previous Close as base price
                    base_price = stock.previous_close
                    if not base_price or base_price <= 0:
                        base_price = stock.last_price # Fallback
                    
                    if base_price and base_price > 0:
                        min_price = (base_price * Decimal('0.90')).quantize(Decimal('0.01'))
                        max_price = (base_price * Decimal('1.10')).quantize(Decimal('0.01'))
                        
                        if limit_price < min_price or limit_price > max_price:
                            return Response({
                                'error': f'Limit price must be within ±10% of previous close (Rs. {base_price})',
                                'range': f'Rs. {min_price} - Rs. {max_price}',
                                'details': 'Circuit Breaker Rule'
                            }, status=status.HTTP_400_BAD_REQUEST)
                except Exception:
                    pass
    
            # Start Atomic Transaction
            with transaction.atomic():
                # 2. Create Order
                order = Order.objects.create(
                    user=user,
                    stock=stock,
                    order_type='SELL',
                    order_mode=order_type,
                    quantity=quantity,
                    price=Decimal(price_input) if price_input else None,
                    status='PENDING'
                )
        
            # 3. Check Execution
            if order_type == 'MARKET':
                should_execute = True
                execution_price = current_price
            elif order_type == 'LIMIT':
                if not price_input:
                     return Response({'error': 'Price required for Limit Order'}, status=status.HTTP_400_BAD_REQUEST)
                limit_price = Decimal(price_input)
                # Sell Limit executes if market price is >= limit price (Sell at Limit or Higher)
                if current_price >= limit_price:
                    should_execute = True
                    execution_price = current_price # Execute at best available (Market)
                else:
                    should_execute = False # Pending until price rises
            
            # 4. Handle Pending
            if not should_execute:
                # Trigger price update even for pending orders!
                trigger_market_data_update()
                
                return Response({
                    'message': f'Sell Limit Order placed for {quantity} {symbol} at Rs. {price_input}. Status: PENDING',
                    'order': {'id': order.id, 'status': 'PENDING'},
                    'new_balance': float(request.user.virtual_balance)
                }, status=status.HTTP_201_CREATED)

            # 5. Execute Order
            gross_amount = execution_price * quantity
            
            # Calculate Fees
            commission = max(Decimal('10'), gross_amount * Decimal('0.004'))
            sebon_fee = gross_amount * Decimal('0.00015')
            dp_fee = Decimal('25')
            
            # CGT Calculation: 5% of Profit
            wacc = holding.average_buy_price
            cost_basis = wacc * quantity
            gross_profit = gross_amount - cost_basis
            
            cgt = Decimal('0')
            if gross_profit > 0:
                cgt = gross_profit * Decimal('0.05') # 5% CGT
            
            total_deductions = commission + sebon_fee + dp_fee + cgt
            net_proceeds = gross_amount - total_deductions
            
            # Update User Balance
            user.virtual_balance += net_proceeds
            user.save()
            
            # Update Holding
            remaining_qty = holding.quantity - quantity
            if remaining_qty == 0:
                holding.delete()
            else:
                holding.quantity = remaining_qty
                holding.save()
                
            # Update Order
            order.status = 'EXECUTED'
            order.save()
            
            # Realized P/L = Net Proceeds - Cost Basis
            realized_pl = net_proceeds - cost_basis
            
            # Create Transaction Record
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
            
            # Trigger async update of ALL stock prices in database
            trigger_market_data_update()
         
            return Response({
            'message': f'Successfully sold {quantity} shares of {symbol} at Rs. {execution_price}. Net: Rs. {net_proceeds:,.2f}',
            'new_balance': float(user.virtual_balance)
         }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f"Processing Error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class PortfolioHistoryView(generics.ListAPIView):
    """Get portfolio value history"""
    serializer_class = PortfolioSnapshotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PortfolioSnapshot.objects.filter(user=self.request.user)[:30]  # Last 30 snapshots


class PastHoldingsView(APIView):
    """Get past holdings - stocks user previously owned but sold completely"""
    permission_classes = [IsAuthenticated]

    # ... existing code ... (abbreviated for brevity in replacement)
    def get(self, request):
        user = request.user
        
        # Get all SELL transactions
        sell_transactions = Transaction.objects.filter(
            user=user, 
            transaction_type='SELL'
        ).select_related('stock').order_by('-created_at')
        
        # Get current holding stock IDs
        current_holding_stock_ids = set(
            Holding.objects.filter(user=user).values_list('stock_id', flat=True)
        )
        
        # Aggregate past holdings by stock (for stocks no longer held)
        from collections import defaultdict
        past_holdings = defaultdict(lambda: {
            'total_qty_sold': 0,
            'total_realized_pl': Decimal('0'),
            'total_sell_value': Decimal('0'),
            'transactions': []
        })
        
        for tx in sell_transactions:
            # Include all sell transactions - both past and current holdings
            stock_id = tx.stock_id
            past_holdings[stock_id]['stock_symbol'] = tx.stock.symbol
            past_holdings[stock_id]['stock_name'] = tx.stock.name
            past_holdings[stock_id]['is_past'] = stock_id not in current_holding_stock_ids
            past_holdings[stock_id]['total_qty_sold'] += tx.quantity
            past_holdings[stock_id]['total_realized_pl'] += tx.realized_pl or Decimal('0')
            past_holdings[stock_id]['total_sell_value'] += tx.net_amount
            past_holdings[stock_id]['transactions'].append({
                'id': tx.id,
                'date': tx.created_at.isoformat(),
                'quantity': tx.quantity,
                'price': float(tx.price),
                'realized_pl': float(tx.realized_pl) if tx.realized_pl else 0,
                'net_amount': float(tx.net_amount)
            })
        
        # Convert to list, filtering to only past holdings (not currently held)
        result = []
        for stock_id, data in past_holdings.items():
            if data['is_past']:  # Only stocks no longer held
                result.append({
                    'stock_symbol': data['stock_symbol'],
                    'stock_name': data['stock_name'],
                    'total_qty_sold': data['total_qty_sold'],
                    'total_realized_pl': float(data['total_realized_pl']),
                    'total_sell_value': float(data['total_sell_value']),
                    'transactions': data['transactions']
                })
        
        return Response(result)


class StockTransactionsView(APIView):
    """Get full transaction history and summary for a specific stock"""
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        user = request.user
        try:
            stock = Stock.objects.get(symbol__iexact=symbol)
        except Stock.DoesNotExist:
            return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
        
        transactions = Transaction.objects.filter(
            user=user, 
            stock=stock
        ).order_by('-created_at')
        
        total_bought = 0
        total_sold = 0
        total_invested = Decimal('0')
        realized_pl = Decimal('0')
        
        tx_data = []
        for tx in transactions:
            if tx.transaction_type == 'BUY':
                total_bought += tx.quantity
                total_invested += tx.net_amount
            elif tx.transaction_type == 'SELL':
                total_sold += tx.quantity
                realized_pl += tx.realized_pl or Decimal('0')
                
            tx_data.append({
                'id': tx.id,
                'type': tx.transaction_type,
                'date': tx.created_at,
                'quantity': tx.quantity,
                'price': tx.price,
                'total': tx.net_amount,
                'realized_pl': tx.realized_pl
            })
            
        current_holding_qty = total_bought - total_sold
        
        return Response({
            'symbol': stock.symbol,
            'summary': {
                'total_traded_qty': total_bought + total_sold,
                'total_buy_qty': total_bought,
                'total_sell_qty': total_sold,
                'current_holding_qty': current_holding_qty,
                'total_invested': total_invested,
                'realized_pl': realized_pl
            },
            'transactions': tx_data
        })

class CancelOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk, user=request.user)
            if order.status != 'PENDING':
                return Response({'error': 'Only pending orders can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
            
            order.status = 'CANCELLED'
            order.save()
            
            # Trigger update on cancellation too
            from stocks_app.tasks import trigger_market_data_update
            trigger_market_data_update()
            
            return Response({'message': 'Order cancelled successfully'}, status=status.HTTP_200_OK)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
class UpdateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk, user=request.user)
            if order.status != 'PENDING':
                return Response({'error': 'Only pending orders can be updated'}, status=status.HTTP_400_BAD_REQUEST)

            # Get new data
            quantity = int(request.data.get('quantity', order.quantity))
            price_input = request.data.get('price')
            if price_input == '': 
                price_input = None
            price = Decimal(price_input) if price_input else None
            
            # Determine new type
            order_type = 'LIMIT' if price else 'MARKET'
            
            # Validation
            if quantity <= 0:
                 return Response({'error': 'Invalid quantity'}, status=status.HTTP_400_BAD_REQUEST)
            
            # If it's a SELL order, check holdings again (in case they increased qty)
            if order.order_type == 'SELL':
                holding = Holding.objects.filter(user=request.user, stock=order.stock).first()
                if not holding or holding.quantity < quantity:
                    return Response({'error': 'Insufficient shares for this quantity'}, status=status.HTTP_400_BAD_REQUEST)

            # Update Order
            order.quantity = quantity
            order.price = price
            order.order_mode = order_type
            order.save()
            
            # Check for Execution (Re-run logic)
            stock = order.stock
            current_price = stock.last_price
            
            if current_price is None:
                 return Response({'message': 'Order updated but market price unavailable for execution'}, status=status.HTTP_200_OK)

            should_execute = False
            execution_price = current_price # Default execution price

            if order_type == 'MARKET':
                should_execute = True
                execution_price = current_price
            elif order_type == 'LIMIT':
                if order.order_type == 'BUY' and current_price <= price:
                    should_execute = True
                    execution_price = current_price if current_price < price else price
                elif order.order_type == 'SELL' and current_price >= price:
                    should_execute = True
                    execution_price = current_price if current_price > price else price
            
            if should_execute:
                with transaction.atomic():
                    # Refresh order to lock
                    order.refresh_from_db()
                    if order.status != 'PENDING': return Response({'message': 'Order updated'}, status=status.HTTP_200_OK)

                    realized_pl = None # Default
                    
                    if order.order_type == 'BUY':
                         # Calculate Cost
                        amount = execution_price * order.quantity
                        commission = max(Decimal('10'), amount * Decimal('0.004'))
                        sebon_fee = amount * Decimal('0.00015')
                        dp_fee = Decimal('25')
                        total_fees = commission + sebon_fee + dp_fee
                        total_cost = amount + total_fees
                        
                        if request.user.virtual_balance < total_cost:
                             return Response({'error': 'Insufficient funds for execution'}, status=status.HTTP_400_BAD_REQUEST)
                        
                        # Deduct Balance
                        request.user.virtual_balance -= total_cost
                        request.user.save()
                        
                        # Update/Create Holding
                        holding, created = Holding.objects.get_or_create(user=request.user, stock=stock)
                        if created:
                            holding.quantity = order.quantity
                            holding.average_buy_price = total_cost / order.quantity
                        else:
                            # Weighted Average
                            total_current_cost = holding.average_buy_price * holding.quantity
                            new_total_cost = total_current_cost + total_cost
                            new_total_qty = holding.quantity + order.quantity
                            holding.average_buy_price = new_total_cost / new_total_qty
                            holding.quantity = new_total_qty
                        holding.save()
                        
                        final_net_amount = total_cost
                        final_fees = total_fees
                        
                    elif order.order_type == 'SELL':
                        # Already validated holding existence above
                        amount = execution_price * order.quantity
                        commission = max(Decimal('10'), amount * Decimal('0.004'))
                        sebon_fee = amount * Decimal('0.00015')
                        dp_fee = Decimal('25')
                        total_deductions = commission + sebon_fee + dp_fee
                        
                        # Capital Gains Tax
                        holding = Holding.objects.get(user=request.user, stock=stock)
                        wacc = holding.average_buy_price
                        cost_basis = wacc * order.quantity
                        gross_price = execution_price * order.quantity # Gross amount
                        
                        # CGT
                        capital_gain = gross_price - cost_basis
                        cgt = Decimal('0')
                        if capital_gain > 0:
                            cgt = capital_gain * Decimal('0.075') # 7.5%
                        
                        total_deductions += cgt
                        net_proceeds = amount - total_deductions
                        
                        # Update Balance
                        request.user.virtual_balance += net_proceeds
                        request.user.save()
                        
                        # Update Holding
                        if holding.quantity == order.quantity:
                            holding.delete()
                        else:
                            holding.quantity -= order.quantity
                            holding.save()
                        
                        # Realized P/L
                        realized_pl = net_proceeds - cost_basis
                        final_net_amount = net_proceeds
                        final_fees = total_deductions

                    # Common Finalization
                    order.status = 'EXECUTED'
                    order.save()
                    
                    Transaction.objects.create(
                        user=request.user,
                        stock=stock,
                        order=order,
                        transaction_type=order.order_type,
                        quantity=order.quantity,
                        price=execution_price,
                        total_amount=amount,
                        fees=final_fees,
                        net_amount=final_net_amount,
                        realized_pl=realized_pl
                    )
                    
                    # Trigger async update of ALL stock prices in database
                    trigger_market_data_update()

                    return Response({
                        'message': f'Order updated and EXECUTED for {quantity} {stock.symbol} at {execution_price}',
                        'new_balance': float(request.user.virtual_balance)
                    }, status=status.HTTP_200_OK)

            # Trigger update even if not executed (order remains PENDING)
            trigger_market_data_update()
            
            return Response({'message': 'Order updated successfully'}, status=status.HTTP_200_OK)

        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
