import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'paper_trading_project.settings')
django.setup()

from stocks_app.services import get_cached_market_depth
import json

depth = get_cached_market_depth('NABIL')
print(json.dumps(depth, indent=2))
