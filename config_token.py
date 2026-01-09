import requests
import json
import os

TOKEN = "EAARi2fxiHugBQQLbQB1VPTkwZCZCiinGOOZC6l2sN528aQhNXJe2pRxzAhFFDvA8fKjEboQYatganijCtwc7mBaJ1cZB6xiZCG86H8tVdaZAJ1kdZBScU2YZCfDDqlVEyZCI9h2nNTD8YXsZC3mO6sZAvsKkQJas2J52QMhwibYVCFyd0ZBqAxWjvk3miUZA3SemGpl8V"
GEMINI_KEY = "AIzaSyDg9EyD8mT0b0ZcgIygfTCf4bXVOOwekyM" # <--- תדביק את המפתח כאן
DATA_FILE = 'li_data.json'

def run():
    print(f"Verifying token...")
    
    # 1. Get Page ID
    try:
        r = requests.get(f"https://graph.facebook.com/v19.0/me/accounts?access_token={TOKEN}")
        data = r.json()
        
        if 'error' in data:
            print(f"Error from Facebook: {data['error']['message']}")
            return

        page_id = ""
        page_name = ""
        
        if 'data' in data and len(data['data']) > 0:
            page = data['data'][0]
            page_id = page['id']
            page_name = page['name']
            print(f"Found Page: {page_name} (ID: {page_id})")
        else:
            print("No pages found for this user. Will save token only.")

        # 2. Update/Create JSON
        current_data = {'posts': [], 'settings': {}, 'campaigns': []}
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    current_data = json.load(f)
            except:
                pass
        
        current_data['settings']['access_token'] = TOKEN
        current_data['settings']['gemini_api_key'] = GEMINI_KEY
        if page_id:
            current_data['settings']['page_id'] = page_id
            
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(current_data, f, indent=4, ensure_ascii=False)
            
        print("Configuration saved successfully.")
        
    except Exception as e:
        print(f"Script Error: {e}")

if __name__ == "__main__":
    run()
