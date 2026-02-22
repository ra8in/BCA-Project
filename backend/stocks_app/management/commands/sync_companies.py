"""
Management command: sync_companies

One-time setup command that:
1. Fetches active company list from NEPSE → stores in DB (symbol, name, sector, id)
2. Fetches today-price → bulk updates price data for all traded stocks
3. For symbols missing from today-price → fetches from company profile (individual)

Usage:
    python manage.py sync_companies               # Full sync: companies + prices
    python manage.py sync_companies --companies-only  # Only sync company list
    python manage.py sync_companies --dry-run     # Preview without saving

When to run:
    - Once during initial project setup
    - Manually if you know new companies have been listed on NEPSE
    - Auto-triggered via _sync_new_companies() in services.py when a new
      symbol is auto-detected in today-price
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal


class Command(BaseCommand):
    help = "Sync active company list and initial price data from NEPSE."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview without saving to DB.',
        )
        parser.add_argument(
            '--companies-only',
            action='store_true',
            help='Only sync company list, skip price fetching.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        companies_only = options['companies_only']

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be saved."))

        # === STEP 1: Sync company list ===
        self.stdout.write("\n=== STEP 1: Syncing active company list from NEPSE ===")
        company_map = self._sync_company_list(dry_run)

        if companies_only:
            self.stdout.write(self.style.SUCCESS("Companies-only mode. Skipping price sync."))
            return

        # === STEP 2: Bulk-fetch prices from today-price ===
        self.stdout.write("\n=== STEP 2: Fetching bulk prices from today-price ===")
        traded_symbols = self._fetch_today_prices(dry_run)

        # === STEP 3: Fetch missing stocks from individual company profile ===
        from stocks_app.models import Stock
        all_active = set(Stock.objects.filter(is_active=True).values_list('symbol', flat=True))
        missing = all_active - traded_symbols

        if missing:
            self.stdout.write(f"\n=== STEP 3: Fetching {len(missing)} missing stocks from company profile ===")
            self._fetch_missing_from_profile(missing, dry_run)
        else:
            self.stdout.write("\n=== STEP 3: All active stocks had data in today-price. No profiles needed. ===")

        # === STEP 4: Fetch and sync indices ===
        self.stdout.write("\n=== STEP 4: Fetching market indices ===")
        self._sync_indices(dry_run)

        self.stdout.write(self.style.SUCCESS("\nSync complete!"))

    def _sync_company_list(self, dry_run):
        """
        Step 1: Fetch ALL tradeable securities using get_security_list() (the complete list),
        then map sectors from get_company_list(). This mirrors the logic in active_companies.py.

        Why get_security_list() and NOT get_company_list()?
        - get_company_list() returns parent companies only (e.g. HIDCL) and misses
          promoter shares (HIDCLP), preferred shares (HEIP), debentures, etc.
        - get_security_list() returns ALL tradeable securities with their exact symbols.
        """
        try:
            from nepse_data_api.market import Nepse
            nepse = Nepse(enable_cache=False)
            securities = nepse.get_security_list()   # ALL tradeable securities
            companies  = nepse.get_company_list()    # Used only for sector mapping
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to fetch security/company list: {e}"))
            return {}

        # Build sector lookup maps (mirrors active_companies.py logic)
        symbol_to_sector = {c.get('symbol'): c.get('sectorName') for c in companies if c.get('symbol')}

        def normalize_name(name):
            if not name: return ""
            name = name.lower()
            for word in ["limited", "ltd.", "ltd", "promoter", "debenture", "bond", "equity", "sanstha", "bittiya"]:
                name = name.split(word)[0]
            return name.strip()

        name_to_sector = {normalize_name(c.get('companyName')): c.get('sectorName') for c in companies if c.get('companyName')}

        def get_sector(symbol, sec_name, security_id):
            """Resolve sector via symbol → prefix → name matching, with API profile fallback."""
            nonlocal nepse
            
            # A. Exact symbol match
            sector = symbol_to_sector.get(symbol)
            # B. Symbol prefix (NABILP → NABIL)
            if not sector:
                for i in range(1, 4):
                    if len(symbol) > i:
                        parent = symbol[:-i]
                        if parent in symbol_to_sector:
                            sector = symbol_to_sector[parent]
                            break
            # C. Name matching (normalized)
            if not sector:
                norm = normalize_name(sec_name)
                sector = name_to_sector.get(norm)
                if not sector:
                    for comp_name, sect in name_to_sector.items():
                        if len(comp_name) > 5 and (comp_name in norm or norm in comp_name):
                            sector = sect
                            break
                            
            # D. Dynamic API Profile Fallback (The robust method)
            if not sector and security_id and not dry_run:
                import time
                for attempt in range(2):
                    try:
                        time.sleep(0.1)  # Rate limit protection for NEPSE API
                        details = nepse.get_security_details(security_id)
                        
                        # Expected structure is details['securityData']['sector']
                        if details and details.get('securityData'):
                            sector = details['securityData'].get('sector')
                            
                            if sector:
                                self.stdout.write(f"  [Profile Fallback] Resolved {symbol} sector: {sector}")
                        break
                    except Exception as e:
                        if attempt == 0:
                            # Token likely expired, get a fresh one
                            from nepse_data_api.market import Nepse
                            nepse = Nepse(enable_cache=False)
                        else:
                            self.stdout.write(self.style.WARNING(f"  [Profile Fallback Failed] {symbol}: {e}"))

            return sector

        # Filter active securities only
        active = [s for s in securities if s.get('activeStatus') == 'A']
        self.stdout.write(f"Found {len(active)} active securities (all tradeable types).")

        from stocks_app.models import Stock, Sector

        created = updated = 0
        company_map = {}  # symbol → company data (for deactivation logic below)

        with transaction.atomic():
            for s in active:
                symbol = s.get('symbol')
                if not symbol:
                    continue

                sec_name = s.get('securityName') or symbol
                security_id = s.get('id')
                sector_name = get_sector(symbol, sec_name, security_id)
                company_map[symbol] = s

                if dry_run:
                    self.stdout.write(f"  [DRY] {symbol:12} | {sec_name[:40]:<40} | {sector_name or 'None'}")
                    continue

                if sector_name:
                    sector, _ = Sector.objects.get_or_create(name=sector_name)
                else:
                    sector = None
                    
                stock, was_created = Stock.objects.get_or_create(
                    symbol=symbol,
                    defaults={
                        'name': sec_name,
                        'nepse_security_id': security_id,
                        'sector': sector,
                        'is_active': True,
                    }
                )

                if was_created:
                    created += 1
                else:
                    changed = False
                    if stock.name != sec_name:
                        stock.name = sec_name
                        changed = True
                    if stock.sector != sector:
                        stock.sector = sector
                        changed = True
                    if security_id and stock.nepse_security_id != security_id:
                        stock.nepse_security_id = security_id
                        changed = True
                    if not stock.is_active:
                        stock.is_active = True
                        changed = True
                    if changed:
                        stock.save()
                        updated += 1

        if not dry_run:
            # Deactivate any DB stocks NOT in today's NEPSE active security list
            active_symbols_set = set(company_map.keys())
            deactivated = Stock.objects.filter(is_active=True).exclude(symbol__in=active_symbols_set).update(is_active=False)
            if deactivated:
                self.stdout.write(self.style.WARNING(f"  Marked {deactivated} stale stock(s) as inactive."))
            self.stdout.write(self.style.SUCCESS(f"Step 1 done. Created: {created}, Updated: {updated}"))

        return company_map

    def _fetch_today_prices(self, dry_run):
        """Step 2: Bulk fetch from today-price and update DB."""
        from datetime import datetime
        traded_symbols = set()

        try:
            from nepse_data_api.market import Nepse
            nepse = Nepse(enable_cache=False)

            url = f"{nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500"
            payload_id = nepse._get_floorsheet_payload_id(0, datetime.now())
            payload = {"id": payload_id}

            response = nepse.session.post(url, headers=nepse._get_auth_headers(), json=payload)
            response.raise_for_status()
            data = response.json()

            prices = []
            if isinstance(data, dict) and 'content' in data:
                prices = data['content']
            elif isinstance(data, list):
                prices = data

            self.stdout.write(f"today-price returned {len(prices)} stocks.")

            if not dry_run:
                from stocks_app.models import Stock

                for p in prices:
                    symbol = p.get('symbol')
                    if not symbol:
                        continue
                    traded_symbols.add(symbol)

                    try:
                        stock = Stock.objects.get(symbol=symbol)
                        stock.last_price = Decimal(str(p.get('closePrice') or p.get('lastUpdatedPrice') or 0))
                        stock.previous_close = Decimal(str(p.get('previousDayClosePrice') or 0))
                        stock.open_price = Decimal(str(p.get('openPrice') or 0))
                        stock.high_price = Decimal(str(p.get('highPrice') or 0))
                        stock.low_price = Decimal(str(p.get('lowPrice') or 0))
                        stock.total_trade_quantity = p.get('totalTradedQuantity') or 0
                        stock.total_traded_value = Decimal(str(p.get('totalTradedValue') or 0))

                        ltp = stock.last_price
                        prev = stock.previous_close
                        stock.change = round(ltp - prev, 2) if ltp > 0 and prev > 0 else Decimal('0')
                        stock.change_percent = round(float(stock.change) / float(prev) * 100, 2) if ltp > 0 and prev > 0 else 0

                        stock.save()
                    except Stock.DoesNotExist:
                        pass

                self.stdout.write(self.style.SUCCESS(f"Step 2 done. Updated prices for {len(traded_symbols)} stocks."))
            else:
                traded_symbols = {p.get('symbol') for p in prices if p.get('symbol')}
                self.stdout.write(f"  [DRY] Would update {len(traded_symbols)} stocks.")

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to fetch today-price: {e}"))

        return traded_symbols

    def _fetch_missing_from_profile(self, missing_symbols, dry_run):
        """
        Step 3: For each missing symbol, fetch from individual company profile.
        Uses a single Nepse session with rate limit handling (sleep + retry).

        get_security_details returns a nested structure:
            {
                'securityMcsData': {lastTradedPrice, previousClose, closePrice, ...},
                'securityData':    {symbol, securityName, sector, ...}
            }
        """
        import time
        from stocks_app.models import Stock
        from decimal import Decimal

        fetched = 0
        failed = 0
        failed_symbols = []

        if dry_run:
            for symbol in missing_symbols:
                self.stdout.write(f"  [DRY] Would fetch profile for {symbol}")
            return

        # Single Nepse instance for all requests (avoids redundant auth per loop)
        from nepse_data_api.market import Nepse
        nepse = Nepse(enable_cache=False)

        for i, symbol in enumerate(sorted(missing_symbols)):
            try:
                stock = Stock.objects.get(symbol=symbol)
                security_id = stock.nepse_security_id

                if not security_id:
                    self.stdout.write(self.style.WARNING(f"  [SKIP] {symbol}: No security ID in DB."))
                    failed += 1
                    continue

                # Rate limit: small delay between requests to avoid NEPSE drops
                if i > 0:
                    time.sleep(0.1)

                # Retry with exponential backoff on connection errors
                details = None
                for attempt in range(3):
                    try:
                        details = nepse.get_security_details(security_id)
                        break
                    except Exception as conn_err:
                        wait = 2 ** attempt  # 1s, 2s, 4s
                        self.stdout.write(self.style.WARNING(
                            f"  [RETRY {attempt+1}/3] {symbol}: {conn_err}. Waiting {wait}s..."
                        ))
                        time.sleep(wait)
                        # The token might have expired, re-initialize the client to get a fresh one
                        nepse = Nepse(enable_cache=False)

                if not details:
                    self.stdout.write(self.style.WARNING(f"  [EMPTY] {symbol}: No profile data returned."))
                    failed += 1
                    failed_symbols.append(symbol)
                    continue

                # Extract from nested structure
                # get_security_details returns:
                #   securityMcsData → price fields (lastTradedPrice, previousClose, etc.)
                #   securityData    → company info (symbol, name, sector)
                mcs = details.get('securityMcsData') or {}

                ltp = Decimal(str(
                    mcs.get('lastTradedPrice') or
                    mcs.get('closePrice') or
                    mcs.get('previousClose') or 0
                ))
                prev_close = Decimal(str(mcs.get('previousClose') or 0))

                stock.last_price = ltp
                stock.previous_close = prev_close
                stock.open_price = Decimal(str(mcs.get('openPrice') or 0))
                stock.high_price = Decimal(str(mcs.get('highPrice') or 0))
                stock.low_price = Decimal(str(mcs.get('lowPrice') or 0))
                stock.total_trade_quantity = mcs.get('totalTradeQuantity') or 0

                stock.change = round(ltp - prev_close, 2) if ltp and prev_close else Decimal('0')
                stock.change_percent = (
                    round(float(stock.change) / float(prev_close) * 100, 2) if prev_close else 0
                )

                stock.save()
                fetched += 1
                self.stdout.write(f"  [OK] {symbol}: LTP={ltp}, Prev={prev_close}")

            except Stock.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  [SKIP] {symbol}: Not in DB."))
                failed += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  [ERR] {symbol}: {e}"))
                failed += 1
                failed_symbols.append(symbol)

        # Final pass: Try to fetch the ones that failed completely one last time
        if failed_symbols:
            self.stdout.write(self.style.WARNING(f"\n--- Retrying {len(failed_symbols)} failed profiles with a longer delay ---"))
            time.sleep(0.1) # Give the API a brief rest before the retry pass
            nepse = Nepse(enable_cache=False)
            
            for symbol in failed_symbols:
                time.sleep(0.1) # Enforce a safe 1s delay for these stragglers
                self.stdout.write(f"  [FINAL RETRY] {symbol}...")
                try:
                    stock = Stock.objects.get(symbol=symbol)
                    security_id = stock.nepse_security_id
                    
                    details = None
                    for attempt in range(2):
                        try:
                            details = nepse.get_security_details(security_id)
                            break
                        except Exception:
                            time.sleep(0.2)
                            nepse = Nepse(enable_cache=False)
                            
                    if not details:
                        self.stdout.write(self.style.ERROR(f"  [FAILED AGAIN] {symbol}"))
                        continue
                        
                    mcs = details.get('securityMcsData') or {}
                    ltp = Decimal(str(
                        mcs.get('lastTradedPrice') or
                        mcs.get('closePrice') or
                        mcs.get('previousClose') or 0
                    ))
                    prev_close = Decimal(str(mcs.get('previousClose') or 0))

                    stock.last_price = ltp
                    stock.previous_close = prev_close
                    stock.open_price = Decimal(str(mcs.get('openPrice') or 0))
                    stock.high_price = Decimal(str(mcs.get('highPrice') or 0))
                    stock.low_price = Decimal(str(mcs.get('lowPrice') or 0))
                    stock.total_trade_quantity = mcs.get('totalTradeQuantity') or 0

                    stock.change = round(ltp - prev_close, 2) if ltp > 0 and prev_close > 0 else Decimal('0')
                    stock.change_percent = (
                        round(float(stock.change) / float(prev_close) * 100, 2) if ltp > 0 and prev_close > 0 else Decimal('0')
                    )

                    stock.save()
                    fetched += 1
                    failed -= 1
                    self.stdout.write(self.style.SUCCESS(f"  [RECOVERED] {symbol}: LTP={ltp}, Prev={prev_close}"))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  [STILL FAILED] {symbol}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"\nStep 3 done. Fetched: {fetched}, Failed/Skipped: {failed}"))
    # Static mapping: NEPSE sub-index name → NEPSE sector name
    # NEPSE has exactly 14 sub-indices. This mapping never changes.
    SUB_INDEX_TO_SECTOR = {
        'Banking SubIndex':                 'Commercial Banks',
        'Development Bank Index':           'Development Banks',
        'Finance Index':                    'Finance',
        'Hotels And Tourism Index':         'Hotels And Tourism',
        'HydroPower Index':                 'Hydro Power',
        'Investment Index':                 'Investment',
        'Life Insurance':                   'Life Insurance',
        'Manufacturing And Processing':     'Manufacturing And Processing',
        'Micro Finance Index':              'Microfinance',
        'Microfinance Index':               'Microfinance',
        'Mutual Fund':                      'Mutual Fund',
        'Non Life Insurance':               'Non Life Insurance',
        'Others Index':                     'Others',
        'Trading Index':                    'Tradings',
        'Corporate Debenture':              'Non-Convertible Debenture',
    }

    def _sync_indices(self, dry_run):
        """
        Step 4: Fetch Main Indices and Sub-Indices from NEPSE.
        
        One-time setup: Sets nepse_id, sector, name, symbol + initial values.
        Live polling (services.py) only updates current_value/change/change_percent.
        
        Uses a hardcoded SUB_INDEX_TO_SECTOR mapping for the ~14 fixed NEPSE sectors.
        """
        from stocks_app.models import MarketIndex, SubIndex, Sector
        from decimal import Decimal

        if dry_run:
            self.stdout.write("  [DRY] Would fetch and update market indices and sub-indices.")
            return

        try:
            from nepse_data_api.market import Nepse
            nepse = Nepse(enable_cache=False)

            # --- Clean up stale duplicates from earlier failed syncs ---
            stale_mi = MarketIndex.objects.filter(nepse_id__isnull=True).delete()[0]
            stale_si = SubIndex.objects.filter(nepse_id__isnull=True).delete()[0]
            if stale_mi or stale_si:
                self.stdout.write(self.style.WARNING(
                    f"  Cleaned up stale records: {stale_mi} MarketIndex, {stale_si} SubIndex"
                ))

            # === 1. Main Indices (NEPSE, Sensitive, Float, Sensitive Float) ===
            main_indices = nepse.get_nepse_index()
            created_main = updated_main = 0

            for item in main_indices:
                name = item.get('index')
                if not name:
                    continue
                nepse_id = int(item['id']) if item.get('id') else None
                symbol = name.upper()[:20]

                idx, created = MarketIndex.objects.update_or_create(
                    nepse_id=nepse_id,
                    defaults={
                        'name': name,
                        'symbol': symbol,
                        'current_value': Decimal(str(item.get('currentValue') or 0)),
                        'change': Decimal(str(item.get('change') or 0)),
                        'change_percent': Decimal(str(item.get('perChange') or 0))
                    }
                )
                if created: created_main += 1
                else: updated_main += 1

            self.stdout.write(self.style.SUCCESS(
                f"  Main Indices: Created {created_main}, Updated {updated_main}"
            ))

            # === 2. Sub-Indices (14 sectors) ===
            sub_indices = nepse.get_sub_indices()
            created_sub = updated_sub = skipped = 0

            for item in sub_indices:
                name = item.get('index')
                if not name:
                    continue
                nepse_id = int(item['id']) if item.get('id') else None
                symbol = name.upper()[:20]

                # Deterministic sector lookup via hardcoded map
                sector_name = self.SUB_INDEX_TO_SECTOR.get(name)
                if not sector_name:
                    self.stdout.write(self.style.WARNING(
                        f"  [UNMAPPED] Sub-index '{name}' not in mapping — skipped. "
                        f"Add it to SUB_INDEX_TO_SECTOR."
                    ))
                    skipped += 1
                    continue

                sector = Sector.objects.filter(name=sector_name).first()
                if not sector:
                    self.stdout.write(self.style.WARNING(
                        f"  [NO SECTOR] '{sector_name}' not in DB for sub-index '{name}' — skipped."
                    ))
                    skipped += 1
                    continue
                
                # Update the Sector's nepse_id to match the SubIndex's nepse_id
                if sector.nepse_id != nepse_id:
                    sector.nepse_id = nepse_id
                    sector.save(update_fields=['nepse_id'])

                sub, created = SubIndex.objects.update_or_create(
                    nepse_id=nepse_id,
                    defaults={
                        'name': name,
                        'symbol': symbol,
                        'sector': sector,
                        'current_value': Decimal(str(item.get('currentValue') or 0)),
                        'change': Decimal(str(item.get('change') or 0)),
                        'change_percent': Decimal(str(item.get('perChange') or 0))
                    }
                )
                if created: created_sub += 1
                else: updated_sub += 1

            self.stdout.write(self.style.SUCCESS(
                f"  Sub-Indices: Created {created_sub}, Updated {updated_sub}, Skipped {skipped}"
            ))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to fetch indices: {e}"))

