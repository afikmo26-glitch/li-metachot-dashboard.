import google.generativeai as genai
import os
import json

# Load key from li_data.json
try:
    with open('li_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        api_key = data['settings'].get('gemini_api_key')
        
    if not api_key:
        print("No API Key found in li_data.json")
    else:
        genai.configure(api_key=api_key)
        print("Listing available models...")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
except Exception as e:
    print(f"Error: {e}")
