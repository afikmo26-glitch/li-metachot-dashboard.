import json
import os

NEW_TOKEN = "EAAXL7ckSxK8BQXv58eEwHd7VCPgQEVQQ1xjJG2fuyNZAHK4ms2RVZBzVNQM9LW8npnBgo2KAXADXCODRAQddJZBKPL4zECyzB1b76wpUOZBDAvAdZAsOYLi34ettPrLNZBq4ZC7DZCzxD3lOUgezPxLAwzjALh2rv9YhzhXbHrdZBk1zydDTUgLMCZCVK6Ie5sYbzwdzRVDeSq5SOAj0E5mHMSEmOF62UOto3jC2EerpplXpB5rGwfdDDwvorXHPMRGKikLDWE7WZB2KiOKhPPoNdiZBNmR2"

# 1. Update config_token.py
with open("config_token.py", "w", encoding="utf-8") as f:
    f.write(f'TOKEN = "{NEW_TOKEN}"\n')
    f.write('PAGE_ID = "339870509204899" # Presumed ID\n')

# 2. Update li_data.json
try:
    if os.path.exists("li_data.json"):
        with open("li_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"settings": {}, "posts": [], "campaigns": []}

    if "settings" not in data:
        data["settings"] = {}
    
    data["settings"]["access_token"] = NEW_TOKEN
    
    with open("li_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print("Successfully updated token in both files.")
except Exception as e:
    print(f"Error updating JSON: {e}")
