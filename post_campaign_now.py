import requests
import json
import os
import sys

# Load API Token
sys.path.append(os.getcwd())
try:
    from config_token import TOKEN
except ImportError:
    print("Error: Could not import TOKEN.")
    sys.exit(1)

# --- CONFIGURATION ---
POST_MESSAGE = """🚧 גידור שערים – אל תתפשרו על חיבורים 🔩
הרבה שואלים אותי:
“למה אתה עושה גידור ושערים מרותכים ולא מחוברים בברגים?”
אז הנה התשובה, פשוט וברור ⬇️
✔ חוזק אמיתי – ריתוך יוצר יחידה אחת חזקה. אין חיבורים שנחלשים עם הזמן.
✔ עמידות לשנים – פחות תזוזות, פחות חופש, פחות תקלות.
✔ מראה נקי ומקצועי – בלי ברגים גלויים, בלי חיבורים חובבניים.
✔ ביטחון – שער וגדר שלא נפתחים, לא מתפרקים ולא “משחקים”.
✔ התאמה אישית – כל מידה, כל סגנון, לפי השטח והצורך שלך.
🔨 אצלי ב־לי מתכות לא עושים קיצורי דרך.
עובדים בריתוך מלא, עם חומרי גלם איכותיים וחשיבה לטווח ארוך.
אם כבר עושים גדר או שער – עושים פעם אחת, כמו שצריך.
📞 לי מתכות
☎️ 054-568-7588
📩 מוזמנים לפנות לייעוץ והצעת מחיר
https://xn--9dbhgcl6ec.vercel.app/
ניתן לקדם את הפוסט כדי להגדיל את התפוצה ל-לי מתכות - קונסטרוקציה בהתאמה אישית."""

IMAGE_PATHS = [
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_0_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_1_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_2_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_3_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_4_1767963528267.jpg"
]

def post_content():
    print("--- Starting Post Process ---")

    # 1. Get Page Details & Token
    print("Fetching Page Access Token...")
    r = requests.get(f"https://graph.facebook.com/v19.0/me/accounts?access_token={TOKEN}")
    try:
        data = r.json()
    except:
        print("Failed to decode JSON from accounts.")
        return

    if 'data' not in data or not data['data']:
        print("No pages found.")
        return
    
    # Take the first page
    page = data['data'][0]
    page_id = page['id']
    page_token = page.get('access_token', TOKEN)
    page_name = page.get('name')
    print(f"Target Page: {page_name} (ID: {page_id})")

    # 2. Upload Images
    media_ids = []
    print(f"Uploading {len(IMAGE_PATHS)} images...")
    
    for i, path in enumerate(IMAGE_PATHS):
        clean_path = path.strip()
        if not os.path.exists(clean_path):
            print(f"Warning: File not found: {clean_path}")
            continue
            
        url_photo = f"https://graph.facebook.com/v19.0/{page_id}/photos"
        payload = {
            'access_token': page_token,
            'published': 'false' # Important: Don't publish yet, just upload
        }
        
        try:
            with open(clean_path, 'rb') as img_file:
                files = {'source': img_file}
                r_img = requests.post(url_photo, data=payload, files=files)
                res_img = r_img.json()
                
                if 'id' in res_img:
                    print(f"  - Image {i+1} uploaded. ID: {res_img['id']}")
                    media_ids.append({'media_fbid': res_img['id']})
                else:
                    print(f"  - Failed to upload image {i+1}: {res_img}")
        except Exception as e:
            print(f"  - Error uploading image {i+1}: {e}")

    if not media_ids:
        print("No images were uploaded successfully. Aborting.")
        return

    # 3. Publish Feed Post
    print("Publishing final post...")
    url_feed = f"https://graph.facebook.com/v19.0/{page_id}/feed"
    payload_feed = {
        'message': POST_MESSAGE,
        'access_token': page_token,
        'attached_media': json.dumps(media_ids)
    }
    
    r_feed = requests.post(url_feed, data=payload_feed)
    res_feed = r_feed.json()
    
    if 'id' in res_feed:
        print("\n" + "="*30)
        print("✅ SUCCESS! Post published successfully.")
        print(f"Post ID: {res_feed['id']}")
        print(f"Link: https://www.facebook.com/{res_feed['id']}")
        print("="*30)
    else:
        print("\n❌ Failed to publish post.")
        print(f"Error: {res_feed}")

if __name__ == "__main__":
    post_content()
