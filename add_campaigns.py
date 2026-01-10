import json
import os
import time

DATA_FILE = 'li_data.json'

# Define standard high-quality campaigns
NEW_CAMPAIGNS = [
    {
        "name": "פינוי מפעלים ומבנים",
        "caption": "🏭 מפעלים, מחסנים ומבני תעשייה – אנחנו כאן בשבילכם!\n\nב-לי מתכות אנחנו מתמחים בפינוי מסודר, מקצועי ובטיחותי של מפעלים ומבנים ישנים.\nמה אנחנו מציעים?\n✅ פירוק קונסטרוקציות ברזל ופלדה\n✅ פינוי מכונות כבדות וציוד ישן\n✅ קניית כל סוגי המתכות במזומן/העברה מיידית\n✅ עבודה עם מנוף וצוות מקצועי\n\nאל תשברו את הראש – תנו למקצוענים לעבוד.\nאנחנו דואגים לכל התהליך מהתחלה ועד הסוף, ומשאירים שטח נקי.\n\n📞 לתיאום סיור והצעת מחיר: 054-568-7588\n📍 שירות בפריסה ארצית\nלי מתכות – הכתובת שלכם למחזור ופינוי.",
        "image_url": "/uploads/factory_dismantle.jpg" # Placeholder, user can change
    },
    {
        "name": "קניית אלומיניום ונחושת",
        "caption": "💰 הופכים פסולת לכסף! 💰\n\nיש לכם שאריות אלומיניום? כבלי נחושת ישנים? מצברים?\nאנחנו קונים את כל סוגי המתכות והאל-מתכות במחירים הטובים בשוק!\n\n🔸 אלומיניום (פרופילים, תריסים, יציקות)\n🔸 נחושת ופליז\n🔸 נירוסטה\n🔸 עופרת ומצברים\n\n🚛 מגיעים עד אליכם עם משאית ומנוף לאיסוף כמויות.\n⚖️ שקילה אמינה ותשלום במקום.\n\nחייגו עכשיו: 054-568-7588\nלי מתכות – מחזור משתלם ושירות הוגן.",
        "image_url": "/uploads/copper_aluminum.jpg"
    },
    {
        "name": "עבודות מנוף והובלה",
        "caption": "🏗️ צריכים להניף? להוביל? אנחנו בדרך! 🚛\n\nשירותי מנוף והובלה לכל מטרה:\n🔹 הנפת ציוד כבד וקונסטרוקציות\n🔹 הובלת מכונות ומבנים ניידים\n🔹 פינוי פסולת ברזל ומתכת\n\nהמשאית שלנו מצוידת במנוף חזק שיודע להתמודד עם כל אתגר.\nנהג מקצועי, שירות אדיב ועמידה בלוחות זמנים.\n\nזמינים לעבודה מיידית!\n📞 להזמנות: 054-568-7588\nלי מתכות.",
        "image_url": "/uploads/crane_service.jpg"
    },
    {
        "name": "קודם כל בטיחות (תדמית)",
        "caption": "🛡️ בטיחות, אמינות, מקצועיות – זה ה-DNA שלנו.\n\nכשאתם בוחרים ב-לי מתכות, אתם בוחרים בראש שקט.\nאנחנו מקפידים על כל נהלי הבטיחות בעבודה, ביטוחים מלאים ועבודה מסודרת.\n\nבין אם זה פירוק סככה מסוכנת או חיתוך מיכלים – אנחנו יודעים איך לעשות את זה נכון.\n\nאל תקחו סיכונים מיותרים. עבדו עם המקצוענים.\n👷 לי מתכות – קונסטרוקציה ופינוי.\n☎️ 054-568-7588",
        "image_url": "/uploads/safety_first.jpg"
    },
    {
        "name": "התקנת שערים וגדרות",
        "caption": "🏡 הבית שלכם הוא המבצר שלכם – שמרו עליו עם שער חזק! 💪\n\nאנחנו מייצרים ומתקינים שערים וגדרות ברזל ברמה הגבוהה ביותר.\n✨ עיצובים בהתאמה אישית\n✨ גלוון וצבע בתנור למניעת חלודה\n✨ ריתוכים חזקים ועמידות לשנים\n\nשער כניסה, גדר לגינה, או שער נגרר לחניה – יש לנו פתרון לכל צורך.\n\nצרו קשר לייעוץ חינם ומדידה:\n📞 054-568-7588\nלי מתכות – איכות מברזל.",
        "image_url": "/uploads/gates_fences.jpg"
    }
]

def add_campaigns():
    if not os.path.exists(DATA_FILE):
        print("Data file not found, creating new one.")
        data = {'campaigns': [], 'settings': {}, 'posts': []}
    else:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

    if 'campaigns' not in data:
        data['campaigns'] = []

    # Add timestamp IDs and append
    count = 0
    current_names = [c.get('name') for c in data['campaigns']]
    
    for c in NEW_CAMPAIGNS:
        if c['name'] not in current_names:
            c['id'] = int(time.time()) + count
            c['image_urls'] = [] # Start without image, user adds later
            data['campaigns'].append(c)
            count += 1
            print(f"Added campaign: {c['name']}")
        else:
            print(f"Skipped existing: {c['name']}")

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print("Done adding campaigns.")

if __name__ == "__main__":
    add_campaigns()
