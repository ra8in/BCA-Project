from decimal import Decimal, ROUND_HALF_UP

class NepseCalculator:
    """
    Centralized service for all NEPSE related calculations.
    Rates are defined here for easy updates.
    """
    SEBON_RATE = Decimal('0.00015')
    DP_FEE = Decimal('25.00')
    INDIVIDUAL_SHORT_CGT = Decimal('0.075')
    INDIVIDUAL_LONG_CGT = Decimal('0.05')
    INSTITUTIONAL_CGT = Decimal('0.10')
    DIVIDEND_TAX_RATE = Decimal('0.05')

    @staticmethod
    def get_commission_rate(amount):
        amount = Decimal(str(amount))
        if amount <= 50000:
            return Decimal('0.0036')
        elif amount <= 500000:
            return Decimal('0.0033')
        elif amount <= 2000000:
            return Decimal('0.0031')
        elif amount <= 10000000:
            return Decimal('0.0027')
        else:
            return Decimal('0.0024')

    @classmethod
    def calculate_commission(cls, share_amount):
        share_amount = Decimal(str(share_amount))
        if share_amount <= 0:
            return Decimal('0.00')
        
        rate = cls.get_commission_rate(share_amount)
        commission = share_amount * rate
        
        # Minimum commission is usually Rs. 10
        return max(Decimal('10.00'), commission)

    @classmethod
    def calculate_buy_sell(cls, mode, qty, price, is_wacc_entry=False, purchase_price=0, investor_type='individual', holding_period='short'):
        qty = Decimal(str(qty))
        price = Decimal(str(price))
        purchase_price = Decimal(str(purchase_price or 0))

        share_amount = qty * price
        commission = cls.calculate_commission(share_amount)
        sebon_fee = share_amount * cls.SEBON_RATE
        
        # Rounding to 2 decimal places usually happens at the end or per line 
        # but standardized financial implementations often round line items.
        # We will keep high precision and round at the end for pure math, 
        # but practically fees are rounded.
        commission = commission.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        sebon_fee = sebon_fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        dp_fee = cls.DP_FEE

        result = {
            'share_amount': share_amount,
            'commission': commission,
            'sebon_fee': sebon_fee,
            'dp_fee': dp_fee,
        }

        if mode == 'buy':
            total_cost = share_amount + commission + sebon_fee + dp_fee
            effective_price = total_cost / qty if qty > 0 else 0
            
            result.update({
                'total_cost': total_cost,
                'effective_price': effective_price
            })
            
        elif mode == 'sell':
            sell_deductions = commission + sebon_fee + dp_fee
            net_selling_amt = share_amount - sell_deductions
            
            # Cost Basis Calculation
            total_cost_basis = Decimal('0.00')
            if is_wacc_entry:
                # User provided direct WACC
                total_cost_basis = purchase_price * qty
            else:
                # Calculate simple cost basis from original buy price
                # This approximates the WACC calculation for that specific lot
                p_amt = purchase_price * qty
                p_comm = cls.calculate_commission(p_amt)
                p_sebon = p_amt * cls.SEBON_RATE
                total_cost_basis = p_amt + p_comm + p_sebon + dp_fee

            profit = net_selling_amt - total_cost_basis
            
            # CGT Calculation
            cgt_rate = Decimal('0')
            if investor_type == 'institutional':
                cgt_rate = cls.INSTITUTIONAL_CGT
            else:
                cgt_rate = cls.INDIVIDUAL_LONG_CGT if holding_period == 'long' else cls.INDIVIDUAL_SHORT_CGT
            
            cgt = (profit * cgt_rate) if profit > 0 else Decimal('0.00')
            cgt = cgt.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            net_receivable = net_selling_amt - cgt
            net_profit = net_receivable - total_cost_basis
            
            # Additional Per Share Stats
            return_per_share = net_receivable / qty if qty > 0 else 0

            result.update({
                'net_selling_amount': net_selling_amt,
                'total_cost_basis': total_cost_basis,
                'gross_profit': profit,
                'cgt': cgt,
                'cgt_rate': cgt_rate,
                'net_receivable': net_receivable,
                'net_profit': net_profit,
                'return_per_share': return_per_share
            })

        return result

    @classmethod
    def calculate_adjustment(cls, adjustment_type, ltp, percent, paid_up=100):
        ltp = Decimal(str(ltp))
        percent = Decimal(str(percent))
        paid_up = Decimal(str(paid_up))
        
        adjusted_price = Decimal('0.00')
        
        if adjustment_type == 'bonus':
            # Price / (1 + Bonus%)
            adjusted_price = ltp / (1 + (percent / 100))
        elif adjustment_type == 'right':
            # (Price + (PaidUp * Right%)) / (1 + Right%)
            # Note: Input percent is usually 20 for 20%, so divide by 100
            numerator = ltp + (paid_up * (percent / 100))
            denominator = 1 + (percent / 100)
            adjusted_price = numerator / denominator
            
        return adjusted_price

    @classmethod
    def calculate_dividend(cls, qty, bonus_percent, cash_percent, face_value=100):
        qty = Decimal(str(qty))
        bonus_percent = Decimal(str(bonus_percent or 0))
        cash_percent = Decimal(str(cash_percent or 0))
        face_value = Decimal(str(face_value))
        
        # Bonus Share Units
        bonus_units = qty * (bonus_percent / 100)
        
        # Gross Cash Amount
        gross_cash = qty * face_value * (cash_percent / 100)
        
        # Tax on Bonus (5% of Face Value of Bonus Shares)
        val_of_bonus = bonus_units * face_value
        tax_on_bonus = val_of_bonus * cls.DIVIDEND_TAX_RATE
        
        # Tax on Cash (5% of Gross Cash)
        tax_on_cash = gross_cash * cls.DIVIDEND_TAX_RATE
        
        total_tax = tax_on_bonus + tax_on_cash
        net_payable = gross_cash - total_tax
        
        payable_by_user = Decimal('0.00')
        if net_payable < 0:
            payable_by_user = abs(net_payable)
            net_payable = Decimal('0.00')
            
        return {
            'bonus_units': bonus_units,
            'gross_cash': gross_cash,
            'tax_on_bonus': tax_on_bonus,
            'tax_on_cash': tax_on_cash,
            'net_cash_receivable': net_payable,
            'payable_by_user': payable_by_user # If tax > cash dividend
        }

    @staticmethod
    def calculate_average(rows):
        total_qty = Decimal('0')
        total_investment = Decimal('0')
        
        processed_rows = []
        
        for row in rows:
            qty = Decimal(str(row.get('qty', 0)))
            price = Decimal(str(row.get('price', 0)))
            
            if qty > 0 and price > 0:
                # Calculate cost for this specific buy
                result = NepseCalculator.calculate_buy_sell('buy', qty, price)
                cost = result['total_cost']
                
                total_qty += qty
                total_investment += cost
                processed_rows.append({
                    'qty': qty,
                    'price': price,
                    'total_cost': cost
                })
        
        average_wacc = total_investment / total_qty if total_qty > 0 else Decimal('0.00')
        
        return {
            'total_qty': total_qty,
            'total_investment': total_investment,
            'average_wacc': average_wacc,
            'rows': processed_rows 
        }
