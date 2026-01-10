import json
import os

DATA_FILE = 'li_data.json'

def fix_urls():
    if not os.path.exists(DATA_FILE):
        print("Data file not found.")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated = False
    
    # Fix campaigns
    for c in data.get('campaigns', []):
        new_urls = []
        for url in c.get('image_urls', []):
            if 'localhost' in url:
                # Convert http://localhost:5000/uploads/file.jpg -> /uploads/file.jpg
                new_url = '/uploads/' + url.split('/uploads/')[-1]
                new_urls.append(new_url)
                updated = True
            else:
                new_urls.append(url)
        c['image_urls'] = new_urls

    if updated:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print("Fixed localhost URLs in data file.")
    else:
        print("No localhost URLs found to fix.")

if __name__ == "__main__":
    fix_urls()
