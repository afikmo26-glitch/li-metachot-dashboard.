import requests
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from config_token import TOKEN
except ImportError:
    print("Error: Could not import TOKEN from config_token.py")
    sys.exit(1)

def check_facebook_connection():
    print(f"Checking connection to Facebook API with token prefix: {TOKEN[:5]}...")
    
    url = f"https://graph.facebook.com/v19.0/me?access_token={TOKEN}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("Success! Successfully reached Facebook API.")
            print(f"Verified User ID: {data.get('id')}")
            print(f"Verified User Name: {data.get('name')}")
            return True
        else:
            print(f"Failed to reach Facebook. Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Network/Connection Error: {e}")
        return False

if __name__ == "__main__":
    check_facebook_connection()
