import requests
import os

BASE_URL = "http://localhost:5000"

def test_health():
    print("1. Testing Server Health...")
    try:
        r = requests.get(f"{BASE_URL}/health")
        if r.status_code == 200:
            print("   [PASS] Server is online.")
        else:
            print(f"   [FAIL] Status code: {r.status_code}")
    except Exception as e:
        print(f"   [FAIL] Connection refused. Is server running? Error: {e}")

def test_ai():
    print("\n2. Testing AI Generation (Gemini)...")
    try:
        r = requests.post(f"{BASE_URL}/api/generate-ai", json={"prompt": "Test post"})
        data = r.json()
        if data.get("success"):
            print("   [PASS] AI generated text successfully.")
            print(f"   Output sample: {data['text'][:50]}...")
        else:
            print(f"   [FAIL] AI Error: {data.get('error')}")
    except Exception as e:
        print(f"   [FAIL] Request error: {e}")

def test_upload():
    print("\n3. Testing Image Upload & Gallery...")
    # Create dummy image
    with open("test_image.txt", "w") as f:
        f.write("dummy image content")
    
    # Rename to .png for validation
    if os.path.exists("test_image.png"): os.remove("test_image.png")
    os.rename("test_image.txt", "test_image.png")
    
    try:
        # Upload
        files = {'file': open('test_image.png', 'rb')}
        r = requests.post(f"{BASE_URL}/api/upload", files=files)
        data = r.json()
        
        if data.get("success"):
            print("   [PASS] Image uploaded.")
            uploaded_url = data['url']
            
            # Verify in Gallery
            r2 = requests.get(f"{BASE_URL}/api/images")
            images = r2.json()
            found = any(img['url'] == uploaded_url for img in images)
            if found:
                 print("   [PASS] Image found in Gallery.")
            else:
                 print("   [FAIL] Image not found in Gallery list.")
                 
            # Cleanup
            filename = uploaded_url.split('/')[-1]
            requests.delete(f"{BASE_URL}/api/images?name={filename}")
            print("   [PASS] Cleanup (Delete) successful.")
            
        else:
             print(f"   [FAIL] Upload failed: {data.get('error')}")
             
    except Exception as e:
        print(f"   [FAIL] Upload error: {e}")
    finally:
        if os.path.exists("test_image.png"): os.remove("test_image.png")

def test_facebook():
    print("\n4. Testing Facebook Connection...")
    # Load settings first
    try:
        r_settings = requests.get(f"{BASE_URL}/api/settings")
        settings = r_settings.json()
        
        r = requests.post(f"{BASE_URL}/api/test-facebook", json=settings)
        data = r.json()
        
        if data.get("success"):
            print(f"   [PASS] Connected to Page: {data['data'].get('name')}")
        else:
            print(f"   [FAIL] Facebook Error: {data.get('error')}")
            
    except Exception as e:
         print(f"   [FAIL] Connection error: {e}")

if __name__ == "__main__":
    test_health()
    test_ai()
    test_upload()
    test_facebook()
