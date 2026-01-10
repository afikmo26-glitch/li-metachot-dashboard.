
import requests
import json

# Your token from config
TOKEN = "EAAXL7ckSxK8BQXv58eEwHd7VCPgQEVQQ1xjJG2fuyNZAHK4ms2RVZBzVNQM9LW8npnBgo2KAXADXCODRAQddJZBKPL4zECyzB1b76wpUOZBDAvAdZAsOYLi34ettPrLNZBq4ZC7DZCzxD3lOUgezPxLAwzjALh2rv9YhzhXbHrdZBk1zydDTUgLMCZCVK6Ie5sYbzwdzRVDeSq5SOAj0E5mHMSEmOF62UOto3jC2EerpplXpB5rGwfdDDwvorXHPMRGKikLDWE7WZB2KiOKhPPoNdiZBNmR2"

GROUP_IDS = [
    "1525708264342462", "234552514042692", "1243893529012869", 
    "503599004054398", "322639774419159", "520009301706497",
    "672753856520763", "468120652844316", "1552858994986548",
    "3900554073496601", "505462370335932", "509092220550600",
    "1252132401472793", "954678227994700", "265991387396694"
]

def get_group_names():
    print("Fetching group names...")
    results = []
    
    for gid in GROUP_IDS:
        try:
            url = f"https://graph.facebook.com/v19.0/{gid}?fields=name&access_token={TOKEN}"
            r = requests.get(url)
            data = r.json()
            
            if 'name' in data:
                name = data['name']
                print(f"Found: {gid} -> {name}")
                results.append({"name": name, "url": f"https://www.facebook.com/groups/{gid}/"})
            else:
                print(f"Failed {gid}: {data.get('error', {}).get('message')}")
                # Fallback
                results.append({"name": f"קבוצה {gid}", "url": f"https://www.facebook.com/groups/{gid}/"})
                
        except Exception as e:
            print(f"Error {gid}: {e}")

    # Generate JSON for JS
    print("\n--- JSON OUTPUT ---")
    print(json.dumps(results, indent=4, ensure_ascii=False))

if __name__ == "__main__":
    get_group_names()
