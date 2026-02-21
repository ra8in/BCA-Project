import json
import sys
from datetime import datetime
from nepse_data_api.market import Nepse

def get_all_stocks_ohlcv():
    print("Initializing NEPSE API...")
    try:
        # Initialize Nepse interface with caching enabled
        nepse = Nepse(enable_cache=True)
        
        # Check Market Status
        try:
            market_status = nepse.get_market_status()
        except Exception as e:
            print(f"Error fetching market status: {e}")
            market_status = {}

        is_open = market_status.get("isOpen") == "OPEN"
        
        if is_open:
            print("Market is ON")
            user_input = input("Do you want to see the data? (y/n): ").strip().lower()
            if user_input != 'y':
                print("Data display skipped.")
                return

            # If user wants data, show Index details first
            try:
                indices = nepse.get_nepse_index()
                nepse_index = next((item for item in indices if item.get("index") == "NEPSE Index"), {})
                sensitive_index = next((item for item in indices if item.get("index") == "Sensitive Index"), {})
                
                print("\n" + "="*40)
                print(f"NEPSE Index: {nepse_index.get('currentValue', 'N/A')} ({nepse_index.get('change', 'N/A')})")
                print(f"Sensitive Index: {sensitive_index.get('currentValue', 'N/A')} ({sensitive_index.get('change', 'N/A')})")
                print("="*40 + "\n")
            except Exception as e:
                print(f"Error fetching indices: {e}")

        else:
            print("Market is OFF")
            # If market is closed, we proceed to show data (default behavior for closed market)
            # You can change this to also ask if needed, but current requirement implies check is for "ON" status.

        # Fetch today's price data
        print("Fetching market session data from 'today-price' API...")
        
        # Use a larger size to ensure we get all stocks (e.g., 2000)
        # Assuming most active stocks are within this limit
        url = f"{nepse.BASE_URL}/api/nots/nepse-data/today-price?size=500"
        
        # Generate payload ID. Note: Using datetime.now() as in the original script
        payload_id = nepse._get_floorsheet_payload_id(0, datetime.now())
        payload = {"id": payload_id}
        
        response = nepse.session.post(url, headers=nepse._get_auth_headers(), json=payload)
        response.raise_for_status()
        data = response.json()
        
        prices = []
        # Handle both list and dictionary (with 'content') responses
        if isinstance(data, dict) and 'content' in data:
            prices = data['content']
        elif isinstance(data, list):
            prices = data
        
        print(f"Fetched data for {len(prices)} stocks.")
        
        # Print the data as formatted JSON
        if prices:
            print(json.dumps(prices, indent=4))
        else:
            print("No data found.")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    get_all_stocks_ohlcv()
