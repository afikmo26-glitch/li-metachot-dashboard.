import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import google.generativeai as genai
from datetime import datetime
import threading
import time
import shutil
import secrets
from functools import wraps

app = Flask(__name__)
CORS(app)  # Enable CORS for the dashboard

DATA_FILE = 'li_data.json'
UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True) # Ensure upload dir exists

logging.basicConfig(level=logging.INFO)

# --- UTILS ---
def load_data():
    if not os.path.exists(DATA_FILE):
        data = {'posts': [], 'settings': {'page_id': '', 'access_token': ''}, 'campaigns': []}
    else:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    
    # Fail-safe: Override with environment variables if present (for Render stability)
    if os.environ.get('FB_PAGE_ID'):
        data['settings']['page_id'] = os.environ.get('FB_PAGE_ID')
    if os.environ.get('FB_ACCESS_TOKEN'):
        data['settings']['access_token'] = os.environ.get('FB_ACCESS_TOKEN')
    if os.environ.get('DASHBOARD_PASSWORD'):
        data['settings']['dashboard_password'] = os.environ.get('DASHBOARD_PASSWORD')
        
    if 'campaigns' not in data: data['campaigns'] = [] # Migration
    return data

# Helper to log actions for persistence
def log_action(action_type, details):
    data = load_data()
    if 'history' not in data:
        data['history'] = []
    
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "type": action_type,
        "details": details
    }
    data['history'].insert(0, entry) # Most recent first
    # Keep last 1000 items
    data['history'] = data['history'][:1000]
    save_data(data)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# --- AUTH MIDDLEWARE ---
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        data = load_data()
        stored_password = data.get('settings', {}).get('dashboard_password', '1234') # Default pass
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or auth_header != stored_password:
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# --- SCHEDULER ---
def run_scheduler():
    while True:
        try:
            check_scheduled_posts()
        except Exception as e:
            print(f"Scheduler Error: {e}")
        time.sleep(60) # Check every minute

def check_scheduled_posts():
    data = load_data()
    settings = data['settings']
    posts = data['posts']
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    modified = False
    for post in posts:
        if post.get('status') == 'scheduled':
            post_dt = f"{post.get('date')} {post.get('time')}"
            if post_dt <= now:
                print(f"Executing scheduled post: {post['id']}")
                res = post_to_facebook(post, settings)
                post['status'] = 'posted' if res['success'] else 'failed'
                post['result'] = res
                modified = True
    
    if modified:
        save_data(data)

# Start Scheduler in Background
threading.Thread(target=run_scheduler, daemon=True).start()

# --- ROUTES ---

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "version": "1.1.0", "scheduler": "running"})

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"})
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"})
    
    if file:
        filename = f"{int(time.time())}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        host = request.host_url.rstrip('/')
        return jsonify({"success": True, "url": f"{host}/uploads/{filename}", "local_path": filepath})

@app.route('/api/images', methods=['GET', 'DELETE'])
@require_auth
def handle_images():
    if request.method == 'GET':
        images = []
        if os.path.exists(UPLOAD_FOLDER):
            for f in os.listdir(UPLOAD_FOLDER):
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                    host = request.host_url.replace('http://', 'https://') if 'onrender.com' in request.host_url else request.host_url
                    host = host.rstrip('/')
                    images.append({
                        "name": f,
                        "url": f"{host}/uploads/{f}",
                        "date": os.path.getmtime(os.path.join(UPLOAD_FOLDER, f))
                    })
        # Sort by date new to old
        images.sort(key=lambda x: x['date'], reverse=True)
        return jsonify(images)
    
    if request.method == 'DELETE':
        filename = request.args.get('name')
        if not filename: return jsonify({"success": False})
        
        path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(path):
            os.remove(path)
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "File not found"})

@app.route('/api/settings', methods=['GET', 'POST'])
@require_auth
def handle_settings():
    data = load_data()
    if request.method == 'POST':
        new_settings = request.json
        data['settings'].update(new_settings)
        save_data(data)
        return jsonify({"status": "saved"})
    return jsonify(data['settings'])

@app.route('/api/campaigns', methods=['GET', 'POST', 'DELETE'])
@require_auth
def handle_campaigns():
    data = load_data()
    if request.method == 'POST':
        campaign = request.json
        campaign['id'] = int(time.time())
        data['campaigns'].append(campaign)
        save_data(data)
        log_action("campaign_saved", {"name": campaign.get('name')})
        return jsonify({"success": True, "campaign": campaign})
    
    if request.method == 'DELETE':
        campaign_id = request.args.get('id')
        data['campaigns'] = [c for c in data['campaigns'] if str(c['id']) != str(campaign_id)]
        save_data(data)
        log_action("campaign_deleted", {"id": campaign_id})
        return jsonify({"success": True})

    return jsonify(data['campaigns'])

@app.route('/api/debug-models', methods=['GET'])
@require_auth
def debug_models():
    api_key = os.environ.get('GEMINI_API_KEY') or load_data().get('settings', {}).get('gemini_api_key')
    if not api_key: return jsonify({"error": "No API Key"})
    try:
        genai.configure(api_key=api_key.strip())
        models = []
        for m in genai.list_models():
            models.append({"name": m.name, "methods": m.supported_generation_methods})
        return jsonify({"models": models})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/generate-image', methods=['POST'])
@require_auth
def generate_image():
    data = load_data()
    settings = data.get('settings', {})
    api_key = os.environ.get('GEMINI_API_KEY') or settings.get('gemini_api_key')
    if api_key: api_key = api_key.strip()
    
    if not api_key:
        return jsonify({"success": False, "error": "חסר מפתח API."})

    prompt = request.json.get('prompt')
    if not prompt:
        return jsonify({"success": False, "error": "לא נשלח תיאור לתמונה."})

    try:
        genai.configure(api_key=api_key)
        
        try:
            # Correct class for Image Generation in google-generativeai SDK
            model = genai.ImageGenerationModel("imagen-3.0-generate-001")
            response = model.generate_images(
                prompt=prompt,
                number_of_images=1,
            )
        except AttributeError:
             return jsonify({
                "success": False, 
                "error": "מנגנון יצירת התמונות (ImageGenerationModel) לא נמצא ב-SDK. וודא שגרסת google-generativeai היא 0.8.0 ומעלה."
            })
        
        if response.images:
            img = response.images[0]
            filename = f"gen_{int(time.time())}.png"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            img.save(filepath)
            
            host = request.host_url.rstrip('/')
            url = f"{host}/uploads/{filename}"
            log_action("image_generated", {"url": url, "prompt": prompt})
            return jsonify({"success": True, "url": url})
        else:
            log_action("image_generation_failed", {"prompt": prompt, "reason": "No images in response"})
            return jsonify({"success": False, "error": "לא התקבלו תמונות מהמודל."})

    except Exception as e:
        error_msg = str(e)
        log_action("image_generation_error", {"prompt": prompt, "error": error_msg})
        if "403" in error_msg:
            error_msg = "שגיאה 403: אין הרשאה ליצירת תמונות. ייתכן שנדרש מנוי בתשלום (Pay-as-you-go) או שהמודל לא זמין באזורך."
        return jsonify({"success": False, "error": error_msg})

@app.route('/api/generate-ai', methods=['POST'])
@require_auth
def generate_ai():
    data = load_data()
    settings = data.get('settings', {})
    api_key = os.environ.get('GEMINI_API_KEY') or settings.get('gemini_api_key')
    if api_key: api_key = api_key.strip()
    
    if not api_key:
        return jsonify({"success": False, "error": "חסר מפתח (API Key). נא להגדיר בהגדרות."})

    context = request.json.get('prompt')
    if not context:
        return jsonify({"success": False, "error": "לא נשלח תוכן לבקשה."})

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # System prompt wrapper
        full_prompt = f"כתוב פוסט לפייסבוק קצר, שיווקי וקליט בעברית עבור עסק למחזור מתכות ('לי מתכות'). הנושא הוא: {context}. השתמש באימוג'ים מתאימים."
        
        response = model.generate_content(full_prompt)
        return jsonify({"success": True, "text": response.text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/posts', methods=['GET', 'POST'])
@require_auth
def handle_posts():
    data = load_data()
    if request.method == 'POST':
        post_data = request.json
        caption = post_data.get('caption')
        image_urls = post_data.get('image_urls', [])
        target_ids = post_data.get('target_ids', [])
        
        # Support single target_id for backwards compat
        if not target_ids and post_data.get('target_id'):
            target_ids = [post_data.get('target_id')]
            
        post_now = post_data.get('post_now', False)
        
        if post_now:
            results = []
            for tid in target_ids:
                res = post_to_facebook(caption, image_urls, tid)
                results.append({"target_id": tid, "success": res.get('id') is not None, "result": res})
            
            log_action("bulk_post_now", {"targets": target_ids, "caption": caption[:50]})
            return jsonify({"success": True, "results": results})
        else:
            scheduled_post = {
                "id": str(int(time.time())),
                "caption": caption,
                "image_urls": image_urls,
                "target_ids": target_ids,
                "scheduled_at": f"{post_data.get('date')} {post_data.get('time')}",
                "status": "pending"
            }
            if 'scheduled_posts' not in data: data['scheduled_posts'] = []
            data['scheduled_posts'].append(scheduled_post)
            save_data(data)
            log_action("post_scheduled", {"id": scheduled_post['id'], "targets": target_ids})
            return jsonify({"status": "scheduled", "post": scheduled_post})
    
    return jsonify(data.get('scheduled_posts', []))

@app.route('/api/history', methods=['GET'])
@require_auth
def get_history():
    data = load_data()
    return jsonify(data.get('history', []))

@app.route('/api/test-facebook', methods=['POST'])
@require_auth
def test_facebook():
    settings = request.json
    page_id = settings.get('page_id')
    token = settings.get('access_token')
    
    if not page_id or not token:
        return jsonify({"success": False, "error": "Missing Page ID or Token"})

    url = f"https://graph.facebook.com/v19.0/{page_id}?fields=name,id&access_token={token}"
    try:
        r = requests.get(url)
        if r.status_code == 200:
            return jsonify({"success": True, "data": r.json()})
        else:
            return jsonify({"success": False, "error": r.text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/groups', methods=['GET'])
@require_auth
def handle_groups():
    try:
        data = load_data()
        token = data['settings'].get('access_token')
        if not token:
            return jsonify({"success": False, "groups": [], "error": "No access token set"})
            
        # Fetch Groups (Admin)
        url = f"https://graph.facebook.com/v19.0/me/groups?fields=name,id,icon,privacy&access_token={token}&admin_only=true"
        r = requests.get(url)
        res_data = r.json()
        
        if 'error' in res_data:
            return jsonify({"success": False, "groups": [], "error": res_data['error'].get('message', 'Facebook API Error')})
            
        groups = res_data.get('data', [])
        return jsonify({"success": True, "groups": groups})
    except Exception as e:
        return jsonify({"success": False, "groups": [], "error": str(e)})

@app.route('/api/verify-token', methods=['GET'])
@require_auth
def verify_token():
    data = load_data()
    token = data['settings'].get('access_token')
    if not token: return jsonify({"success": False, "error": "No token"})
    
    url = f"https://graph.facebook.com/v19.0/me?access_token={token}"
    try:
        r = requests.get(url)
        res = r.json()
        if 'id' in res:
            return jsonify({"success": True, "user": res.get('name')})
        else:
            return jsonify({"success": False, "error": res.get('error', {}).get('message', 'Invalid Token')})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def post_to_facebook(post, settings):
    target_id = post.get('target_id')
    token = settings.get('access_token')
    
    if not target_id:
        target_id = settings.get('page_id')

    if not target_id or not token:
        return {"success": False, "error": "No credentials or target"}

    image_urls = post.get('image_urls', [])
    # Support legacy single image field
    single_image = post.get('image_url')
    if single_image and single_image not in image_urls:
        image_urls.append(single_image)

    if not image_urls:
        # Standard text post
        url = f"https://graph.facebook.com/v19.0/{target_id}/feed"
        payload = {'message': post.get('caption'), 'access_token': token}
        try:
            r = requests.post(url, data=payload)
            response = r.json()
            return {"success": True, "id": response.get('id')} if r.status_code == 200 else {"success": False, "error": response.get('error', {}).get('message', r.text)}
        except Exception as e: return {"success": False, "error": str(e)}

    # Multi-photo post (even if just 1 photo)
    media_ids = []
    for img_url in image_urls:
        upload_url = f"https://graph.facebook.com/v19.0/{target_id}/photos"
        payload = {'access_token': token, 'published': 'false'}
        files = None
        
        # Check for local file
        if "/uploads/" in img_url:
            filename = img_url.split("/uploads/")[-1]
            local_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(local_path):
                files = {'source': open(local_path, 'rb')}
            else: continue # Skip missing local files
        else:
            payload['url'] = img_url

        try:
            r = requests.post(upload_url, data=payload, files=files)
            if files: files['source'].close()
            res = r.json()
            if 'id' in res:
                media_ids.append({"media_fbid": res['id']})
        except: continue

    if not media_ids:
        return {"success": False, "error": "Failed to upload any images"}

    # Final post with attached media
    feed_url = f"https://graph.facebook.com/v19.0/{target_id}/feed"
    payload = {
        'message': post.get('caption'),
        'access_token': token,
        'attached_media': json.dumps(media_ids)
    }
    try:
        r = requests.post(feed_url, data=payload)
        res = r.json()
        if r.status_code == 200:
            return {"success": True, "id": res.get('id')}
        else:
            err = res.get('error', {})
            error_msg = err.get('message', r.text)
            # Add specific help for common FB errors
            if "permissions" in error_msg.lower():
                error_msg += " (Check if the app has 'publish_to_groups' permission or is added to the group settings)"
            return {"success": False, "error": error_msg}
    except Exception as e: 
        return {"success": False, "error": f"Connection Error: {str(e)}"}

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"KAKASHI Automation Server Running on Port {port}...")
    app.run(host='0.0.0.0', port=port)
