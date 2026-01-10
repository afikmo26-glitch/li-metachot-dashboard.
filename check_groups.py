import requests
import json
import os
import sys

# Load token from config or data file
try:
    with open('li_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        TOKEN = data['settings'].get('access_token')
except Exception:
    try:
        from config_token import TOKEN
    except ImportError:
        TOKEN = os.environ.get('FB_ACCESS_TOKEN')

if not TOKEN:
    print("Error: Could not find Access Token in settings or config.")
    sys.exit(1)

def check_groups():
    print(f"Checking Groups Permissions with token: {TOKEN[:5]}...")
    
    # 1. Check Permissions
    print("\n1. Checking Token Permissions...")
    perm_url = f"https://graph.facebook.com/v19.0/me/permissions?access_token={TOKEN}"
    r = requests.get(perm_url)
    if r.status_code == 200:
        perms = r.json().get('data', [])
        has_groups = any(p['permission'] == 'groups_access_member_info' and p['status'] == 'granted' for p in perms)
        has_publish = any(p['permission'] == 'publish_to_groups' and p['status'] == 'granted' for p in perms)
        
        print("   Found permissions:")
        for p in perms:
            if p['status'] == 'granted':
                print(f"   - {p['permission']}")
                
        if not has_publish:
            print("\n   WARNING: You are missing 'publish_to_groups' permission!")
            print("   You won't be able to post to groups without this.")
    else:
        print(f"   Failed to check permissions: {r.text}")

    # 2. Fetch Groups
    print("\n2. Fetching Admin Groups...")
    # Trying without admin_only first to see what we can see
    url = f"https://graph.facebook.com/v19.0/me/groups?fields=name,id,privacy,administrator&limit=50&access_token={TOKEN}"
    r = requests.get(url)
    
    if r.status_code == 200:
        data = r.json()
        groups = data.get('data', [])
        
        if not groups:
            print("   No groups found using this token.")
            print("   Note: The API may only return groups where you are an Admin AND have installed the App.")
        else:
            print(f"   Found {len(groups)} groups:")
            for g in groups:
                role = "Admin" if g.get('administrator') else "Member"
                print(f"   - {g['name']} (ID: {g['id']}) - {role}")
                
            print("\n   To post to these groups:")
            print("   1. You must be an Administrator.")
            print("   2. You must go to the Group Settings on Facebook -> Apps -> Add App -> Select this App.")
    else:
        print(f"   Error fetching groups: {r.text}")

if __name__ == "__main__":
    check_groups()
