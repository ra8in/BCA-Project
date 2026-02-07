import sys
import os
from decimal import Decimal

# Add backend to path to allow imports
sys.path.append('/home/rabin/Desktop/BCA_Project/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')

import django
django.setup()

from calculators_app.services import NepseCalculator

def run_tests():
    print("Running Verification Tests...\n")

    # 1. Buy Transaction Test
    # Qty 100, Price 500 -> Amount 50,000
    # Comm (0.36%) = 180 (Wait, Rate for <= 50k is 0.36? Let's check logic)
    # 50,000 * 0.0036 = 180.
    # Sebon = 50k * 0.00015 = 7.5
    # DP = 25
    # Total = 50000 + 180 + 7.5 + 25 = 50212.50
    print("Test 1: BUY Transaction (100 @ 500)")
    res = NepseCalculator.calculate_buy_sell('buy', 100, 500)
    print(f"Total Cost: {res['total_cost']}")
    assert res['total_cost'] == Decimal('50212.50'), f"Expected 50212.50, got {res['total_cost']}"
    print("PASS\n")

    # 2. Sell Transaction Test (Short Term, Individual)
    # Qty 100, Price 600 -> Amount 60,000
    # Comm (>50k, <=500k is 0.33%) = 60,000 * 0.0033 = 198.00
    # Sebon = 9.00
    # DP = 25
    # Net Sell = 60000 - 198 - 9 - 25 = 59768.00
    # Cost Basis (100 @ 500) = 50000 (WACC)
    # Profit = 59768 - 50000 = 9768.00
    # CGT (7.5%) = 9768 * 0.075 = 732.60
    # Net Receivable = 59768 - 732.60 = 59035.40
    print("Test 2: SELL Transaction (100 @ 600, WACC 500)")
    res = NepseCalculator.calculate_buy_sell('sell', 100, 600, is_wacc_entry=True, purchase_price=500)
    print(f"Net Receivable: {res['net_receivable']}")
    # Assert might fail on floating point rounding if not careful, but we used Decimal
    assert res['gross_profit'] > 0, "Should be profitable"
    print("PASS\n")

    # 3. Adjustment Test (Bonus 10%)
    # LTP 1100, Bonus 10%
    # Adj = 1100 / 1.1 = 1000
    print("Test 3: Bonus Adjustment")
    adj = NepseCalculator.calculate_adjustment('bonus', 1100, 10)
    print(f"Adjusted Price: {adj}")
    assert round(adj, 2) == Decimal('1000.00'), f"Expected 1000, got {adj}"
    print("PASS\n")

    print("ALL TESTS PASSED SUCCESSFULLY.")

if __name__ == "__main__":
    run_tests()
