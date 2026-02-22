from nepse_data_api.market import Nepse

def list_active_securities():
    """
    Fetches and displays all active securities (Ordinary, Promoters, Debentures, etc.)
    from NEPSE, including IDs and sector information.
    """
    print("Initializing NEPSE API...")
    try:
        # Initialize Nepse interface
        nepse = Nepse(enable_cache=True)
        
        print("Fetching security and company lists...")
        securities = nepse.get_security_list()
        # The company list is our source for Sectors
        companies = nepse.get_company_list()
        
        if not securities:
            print("Error: No security data returned from API.")
            return

        # 1. Map symbols to sectors (NABIL -> Commercial Banks)
        symbol_to_sector = {c.get('symbol'): c.get('sectorName') for c in companies if c.get('symbol')}
        
        # 2. Normalize names to help matching (explained below)
        # Why this function? (User Question Answer):
        # Different lists use different names for the same company. 
        # Example: One list says "Nabil Bank Ltd" and another says "Nabil Bank Promoter".
        # This function cuts off "Ltd", "Promoter", etc., so "Nabil Bank" matches both.
        def normalize_name(name):
            if not name: return ""
            name = name.lower()
            # Stop matching after these words to keep only the core company name
            for word in ["limited", "ltd.", "ltd", "promoter", "debenture", "bond", "equity", "sanstha", "bittiya"]:
                name = name.split(word)[0]
            return name.strip()

        # 3. Create a Name-to-Sector map using normalized names
        name_to_sector = {normalize_name(c.get('companyName')): c.get('sectorName') for c in companies if c.get('companyName')}

        active_list = []
        for s in securities:
            # We only want Active (listed) items
            if s.get('activeStatus') == 'A':
                id_val = s.get('id', 'N/A')
                symbol = s.get('symbol', 'N/A')
                sec_name = s.get('securityName', 'N/A')
                
                # --- Step-by-Step Sector Matching ---
                # A. Try exact symbol match
                sector = symbol_to_sector.get(symbol)
                
                # B. Try symbol prefix (NABILP -> NABIL)
                if not sector:
                    for i in range(1, 4):
                        if len(symbol) > i:
                            parent_sym = symbol[:-i]
                            if parent_sym in symbol_to_sector:
                                sector = symbol_to_sector[parent_sym]
                                break

                # C. Try Name Matching (Nabil Bank Promoter -> Nabil Bank)
                if not sector:
                    norm_sec_name = normalize_name(sec_name)
                    # Check for direct match or partial match
                    if norm_sec_name in name_to_sector:
                        sector = name_to_sector[norm_sec_name]
                    else:
                        for comp_name, sect in name_to_sector.items():
                            if len(comp_name) > 5 and (comp_name in norm_sec_name or norm_sec_name in comp_name):
                                sector = sect
                                break
                
                active_list.append({
                    'id': id_val,
                    'symbol': symbol,
                    'name': sec_name,
                    'sector': sector or 'N/A'
                })

        # Table formatting
        print(f"\n--- ACTIVE SECURITIES ({len(active_list)}) ---")
        print(f"{'ID':<10} {'Symbol':<12} {'Security Name':<45} {'Sector':<20}")
        print("-" * 105)
        
        sorted_active = sorted(active_list, key=lambda x: x.get('symbol', ''))
        
        for item in sorted_active:
            name = item['name']
            if len(name) > 42:
                name = name[:39] + "..."
            
            print(f"{item['id']:<10} {item['symbol']:<12} {name:<45} {item['sector']:<20}")

        # Summary counts
        print(f"\nSummary:")
        print(f"Total Active Securities: {len(active_list)}")
        na_count = len([x for x in active_list if x['sector'] == 'N/A'])
        print(f"Mapped Sectors: {len(active_list) - na_count} | Missing Sectors (N/A): {na_count}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    list_active_securities()
