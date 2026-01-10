import json
import os
import shutil
import time

# 1. Setup Source Data
CAPTION = """🚧 גידור שערים – אל תתפשרו על חיבורים 🔩
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

SOURCE_IMAGES = [
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_0_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_1_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_2_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_3_1767963528267.jpg",
    r"C:/Users/אמיר/.gemini/antigravity/brain/c9955c50-91b7-43e1-8f24-19a111d09048/uploaded_image_4_1767963528267.jpg"
]

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 2. Process Images
final_image_urls = []
print(f"Processing {len(SOURCE_IMAGES)} images...")

for i, src in enumerate(SOURCE_IMAGES):
    filename = f"imported_gate_{i}_{int(time.time())}.jpg"
    dst = os.path.join(UPLOAD_DIR, filename)
    
    try:
        shutil.copy2(src, dst)
        # We assume the server runs on localhost:5000 for the relative path to work, 
        # or we store the relative path for the frontend to resolve.
        # The frontend expects full URLs usually, but let's see server.py logic.
        # server.py handles /uploads/ serves.
        # Ideally we store a URL that the frontend can display. 
        # Since we don't know the dynamic host (ngrok/localhost), let's store a relative path marker
        # or construct a localhost URL. 
        # Actually server.py line 433 handles local check: if "/uploads/" in img_url.
        
        # We will use a relative-like URL that the frontend is likely to handle or we can fix in frontend.
        # But wait, the frontend displays images setting `src`. `src` must be valid.
        # If we use `http://localhost:5000/uploads/...` it works locally.
        
        final_url = f"http://localhost:5000/uploads/{filename}"
        final_image_urls.append(final_url)
        print(f" - Copied to {dst}")
    except Exception as e:
        print(f" - Failed to copy {src}: {e}")

# 3. Create Campaign Object
new_campaign = {
    "id": int(time.time()),
    "name": "פוסט גידור ושערים (מיובא)",
    "caption": CAPTION,
    "image_urls": final_image_urls,
    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
}

# 4. Save to li_data.json
DATA_FILE = 'li_data.json'
try:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {'campaigns': [], 'settings': {}, 'posts': []}
    
    if 'campaigns' not in data:
        data['campaigns'] = []
        
    data['campaigns'].append(new_campaign)
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        
    print("✅ Campaign saved successfully!")
    print(f"Title: {new_campaign['name']}")
    print(f"Images: {len(new_campaign['image_urls'])}")
    
except Exception as e:
    print(f"❌ Error saving data: {e}")
