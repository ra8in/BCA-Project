"""
Centralized NEPSE trading fee constants and calculation utilities.

All trading views and services should use these functions instead of
hardcoding fee constants inline. This prevents inconsistencies
(e.g., different CGT rates in different code paths).
"""

from decimal import Decimal


# ===== NEPSE Fee Constants =====
COMMISSION_RATE = Decimal('0.004')      # 0.4% broker commission
MIN_COMMISSION = Decimal('10')          # Minimum Rs. 10 commission
SEBON_RATE = Decimal('0.00015')         # 0.015% SEBON regulatory fee
DP_FEE = Decimal('25')                  # Rs. 25 depository participant fee
CGT_RATE = Decimal('0.075')  # 7.5% Capital Gains Tax on profit


def calculate_buy_fees(amount: Decimal) -> tuple:
    """
    Calculate total fees for a BUY transaction.

    Args:
        amount: Gross trade amount (price × quantity)

    Returns:
        (total_fees, fee_breakdown) where fee_breakdown is a dict
    """
    commission = max(MIN_COMMISSION, amount * COMMISSION_RATE)
    sebon_fee = amount * SEBON_RATE
    total_fees = commission + sebon_fee + DP_FEE

    return total_fees, {
        'commission': commission,
        'sebon_fee': sebon_fee,
        'dp_fee': DP_FEE,
    }


def calculate_sell_fees(amount: Decimal, gross_profit: Decimal) -> tuple:
    """
    Calculate total fees/deductions for a SELL transaction.

    Args:
        amount:       Gross trade amount (price × quantity)
        gross_profit: Gross profit (sell_amount − cost_basis). CGT only on positive.

    Returns:
        (total_deductions, fee_breakdown) where fee_breakdown is a dict
    """
    commission = max(MIN_COMMISSION, amount * COMMISSION_RATE)
    sebon_fee = amount * SEBON_RATE
    cgt = gross_profit * CGT_RATE if gross_profit > 0 else Decimal('0')
    total_deductions = commission + sebon_fee + DP_FEE + cgt

    return total_deductions, {
        'commission': commission,
        'sebon_fee': sebon_fee,
        'dp_fee': DP_FEE,
        'cgt': cgt,
    }
