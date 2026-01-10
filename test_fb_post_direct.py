import requests
import json
import sys
import os

# Add current directory to path so we can import config_token
sys.path.append(os.getcwd())

try:
    from config_token import TOKEN
except ImportError:
    print("Could not import TOKEN from config_token.py. Make sure the file exists.")
    sys.exit(1)

def test_post():
    print("Attempting to post to Facebook using provided token...")
    
    # 1. Get Page ID (verify token works and get target)
    print("Fetching accounts...")
    url_accounts = f"https://graph.facebook.com/v19.0/me/accounts?access_token={TOKEN}"
    r = requests.get(url_accounts)
    
    try:
        data = r.json()
    except Exception as e:
        print(f"Failed to parse JSON response: {r.text}")
        return
    
    if 'error' in data:
        print(f"Error getting accounts: {data['error']['message']}")
        return

    if 'data' not in data or len(data['data']) == 0:
        print("No pages found for this user.")
        return

    page = data['data'][0]
    page_id = page['id']
    # The token in the accounts list is the Page Access Token
    page_token = page.get('access_token') 
    page_name = page['name']
    
    print(f"Found Page: {page_name} (ID: {page_id})")
    
    if not page_token:
        print("Could not find Page Access Token in response. Using User Token (might post as user on page).")
        page_token = TOKEN

    # 2. Post content
    message = "Test post from AI Agent check system connection 2."
    url_post = f"https://graph.facebook.com/v19.0/{page_id}/feed"
    payload = {
        'message': message,
        'access_token': page_token
    }
    
    print(f"Posting message: '{message}'...")
    r_post = requests.post(url_post, data=payload)
    res_post = r_post.json()
    
    if 'id' in res_post:
        print(f"Success! Post ID: {res_post['id']}")
        print(f"View post at: https://www.facebook.com/{res_post['id']}")
    else:
        print(f"Failed to post: {res_post}")

if __name__ == "__main__":
    test_post()
