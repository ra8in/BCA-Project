"""
Management command: fix_previous_close

Fetches today-price from NEPSE API, extracts the real previousDayClosePrice
for each stock, updates Stock.previous_close, and recalculates change /
change_percent.  Also clears per-stock cache so the next request serves
fresh data.

Usage:
    python manage.py fix_previous_close
"""

from django.core.management.base import BaseCommand
from django.core.cache import cache
from decimal import Decimal
import datetime


class Command(BaseCommand):
    help = "Fix Stock.previous_close from NEPSE API and recalculate change values"

    def handle(self, *args, **options):
        from stocks_app.services import _get_nepse_client, _nepse_request, safe_decimal
        from stocks_app.models import Stock

        self.stdout.write("Fetching today-price from NEPSE API...")

        n = _get_nepse_client()
        all_prices = []
        page, total_pages = 0, 1

        while page < total_pages:
            url = (
                f"{n.BASE_URL}/api/nots/nepse-data/today-price"
                f"?size=500&page={page}"
            )
            pid = n._get_floorsheet_payload_id(0, datetime.datetime.now())
            try:
                data = _nepse_request("post", url, json={"id": pid}).json()
            except Exception as e:
                self.stderr.write(f"  API error on page {page}: {e}")
                break

            if isinstance(data, dict):
                all_prices.extend(data.get("content", []))
                total_pages = data.get("totalPages", 1)
            elif isinstance(data, list):
                all_prices.extend(data)
                break
            page += 1

        self.stdout.write(f"  Fetched {len(all_prices)} stocks from NEPSE")

        updated = 0
        for item in all_prices:
            sym = item.get("symbol")
            prev = safe_decimal(item.get("previousDayClosePrice") or 0)
            ltp = safe_decimal(
                item.get("closePrice") or item.get("lastUpdatedPrice") or 0
            )

            if not sym or prev <= 0 or ltp <= 0:
                continue

            change = round(ltp - prev, 2)
            chg_pct = round(float(change) / float(prev) * 100, 2)

            rows = Stock.objects.filter(symbol=sym, is_active=True).update(
                previous_close=prev,
                last_price=ltp,
                change=Decimal(str(change)),
                change_percent=Decimal(str(chg_pct)),
            )
            if rows:
                updated += 1
                # Clear per-stock cache
                cache.delete(f"stock_price:{sym}")

        # Clear aggregate cache keys
        for key in [
            "all_stock_prices_mapped",
            "all_stock_prices_mapped:stale",
            "global_stock_cache",
            "all_stock_cache",
        ]:
            cache.delete(key)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Updated {updated} stocks. "
                f"previous_close now holds yesterday's close price."
            )
        )

        # Print top 5 gainers as verification
        self.stdout.write("\nTop 5 gainers after fix:")
        for s in Stock.objects.filter(is_active=True).order_by("-change_percent")[:5]:
            self.stdout.write(
                f"  {s.symbol}: ltp={s.last_price}  prev={s.previous_close}"
                f"  chg%={s.change_percent}"
            )
        self.stdout.write("\nTop 5 losers after fix:")
        for s in Stock.objects.filter(is_active=True).order_by("change_percent")[:5]:
            self.stdout.write(
                f"  {s.symbol}: ltp={s.last_price}  prev={s.previous_close}"
                f"  chg%={s.change_percent}"
            )
