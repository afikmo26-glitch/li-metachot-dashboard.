import json
import os
import time

DATA_FILE = 'li_data.json'

# New correct campaigns based on websites
# https://xn--9dbhgcl6ec.vercel.app/ -> Construction, Renovations, Metalwork (60 years exp)
# https://orchids-neve-aluminum-site.vercel.app/ -> Aluminum Fences, Gates, Pergolas

NEW_CAMPAIGNS = [
    {
        "name": "גדרות ושערים מאלומיניום (יוקרתי)",
        "caption": "✨ הבית שלכם ראוי לכניסה מרשימה! ✨\n\nב-לי מתכות אנחנו מתמחים בתכנון ועיצוב גדרות ושערים מאלומיניום ברמה הגבוהה ביותר.\n\n✅ עמידות ב-100% לחלודה ולמזג אוויר\n✅ עיצובים מודרניים בהתאמה אישית (הייטק, קלאסי, נקי)\n✅ ללא צורך בתחזוקה או צביעה מחדש\n✅ התקנה מהירה וגימור מושלם\n\nשדרגו את חזית הבית עם מראה יוקרתי שנשמר לשנים.\n\n📍 שירות בצפון ובכל הארץ\n📞 לתיאום פגישת ייעוץ ומדידה: 054-568-7588\nלי מתכות – איכות פוגשת עיצוב.",
        "image_url": "/uploads/alum_gate.jpg"
    },
    {
        "name": "שיפוצים ובנייה (ניסיון של 60 שנה)",
        "caption": "🏠 בונים? משפצים? בחרו בניסיון של 60 שנה! 🏠\n\nלי מתכות מציעים שירותי בנייה ושיפוצים כלליים ברמה אחרת.\nדור שלישי של קבלנים עם מוניטין של אמינות ומקצועיות.\n\n🛠️ שיפוץ דירות ובתים פרטיים (קומפלט)\n🛠️ תוספות בנייה והרחבות\n🛠️ עבודות גמר ושלד\n🛠️ ליווי צמוד משלב התכנון ועד המפתח\n\nאל תתפשרו על איכות הבנייה של הבית שלכם.\nפנו למקצוענים הוותיקים בתחום.\n\n☎️ חייגו אלינו: 054-568-7588\nלי מתכות – בונים לכם עתיד.",
        "image_url": "/uploads/renovations.jpg"
    },
    {
        "name": "פרגולות ופתרונות הצללה",
        "caption": "☀️ השמש קופחת? זה הזמן לפרגולה מושלמת! ☀️\n\nהפכו את הגינה או המרפסת שלכם לפינה הכי נעימה בבית עם הפרגולות של לי מתכות.\n\n🍃 פרגולות אלומיניום (ללא תחזוקה!)\n🍃 עיצובים תלויים או על עמודים\n🍃 הצללה מלאה או חלקית\n🍃 שילוב תאורה נסתרת למראה יוקרתי\n\nפתרונות הצללה עמידים, יפים ופרקטיים.\n\nלפרטים והצעת מחיר:\n📩 שלחו הודעה או חייגו 054-568-7588\nלי מתכות.",
        "image_url": "/uploads/pergola.jpg"
    },
    {
        "name": "מסגרות כללית ומקצועית",
        "caption": "🔥 עבודות מסגרות מדויקות לכל צורך 🔥\n\nצריכים מעקה למדרגות? סורגים מעוצבים? קונסטרוקציה מיוחדת?\nב-לי מתכות אנחנו מבצעים את כל סוגי עבודות המסגרות והריתוך.\n\n✔️ מעקות פנים וחוץ בטיחותיים ומעוצבים\n✔️ מדרגות ברזל מרחפות\n✔️ גלריות וקונסטרוקציות פלדה\n✔️ סורגים אסתטיים לחלונות\n\nדיוק, חוזק ואסתטיקה בכל ריתוך.\n\n📞 דברו איתנו: 054-568-7588",
        "image_url": "/uploads/metalwork.jpg"
    },
    {
        "name": "שערים חשמליים לחניה",
        "caption": "🚗 חניה נוחה ובטוחה מתחילה בשער איכותי 🚗\n\nהתקנת שערים חשמליים לחניות פרטיות ומשותפות.\n🔹 שערים נגררים ומרחפים\n🔹 שערי כנף\n🔹 מנועים איכותיים ושקטים\n🔹 שליטה מהנייד/שלט\n\nנוחות מקסימלית וביטחון לרכב שלכם.\n\nהזמינו טכנאי למדידה: 054-568-7588\nלי מתכות – פתרונות כניסה חכמים.",
        "image_url": "/uploads/electric_gate.jpg"
    }
]

def reset_and_add_campaigns():
    # Load existing to maybe keep settings, but wipe campaigns
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {'campaigns': [], 'settings': {}, 'posts': []}

    # WIPE OLD CAMPAIGNS
    data['campaigns'] = []
    
    # Add new ones
    for i, c in enumerate(NEW_CAMPAIGNS):
        c['id'] = int(time.time()) + i
        c['image_urls'] = [] # User puts their own photos
        data['campaigns'].append(c)
        print(f"Added: {c['name']}")

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print("✅ Successfully replaced all campaigns.")

if __name__ == "__main__":
    reset_and_add_campaigns()
