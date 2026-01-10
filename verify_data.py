import json
import sys

# Force utf-8 output for console
sys.stdout.reconfigure(encoding='utf-8')

try:
    with open('li_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        campaigns = data.get('campaigns', [])
        print(f"Found {len(campaigns)} campaigns:")
        for c in campaigns:
            print(f"- {c.get('name')} (ID: {c.get('id')})")
            
except Exception as e:
    print(f"Error reading file: {e}")
