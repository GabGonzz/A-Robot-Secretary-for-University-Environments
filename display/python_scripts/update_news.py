import requests
from bs4 import BeautifulSoup
import json
import os
import re

def get_unitn_news_hybrid():
    list_url = "https://www.unitn.it/en/news"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'}
    
    # Mock text that will be seen in the news detail, since it was not possible to see the real one
    PRESET_CONTENT = {
        "834": "From March 26th to 29th, the University and the city of Trento will host a series of events aimed at schools, citizens, and the academic and student community, to share reflections and best practices on the climate crisis. The topic will be addressed from multiple perspectives: scientific, ethical-philosophical, communicative, and legal.",
        "829": "The Euregio Science Fund is back with its sixth call for research projects. This initiative supports multi-country research projects involving partners from Tyrol, South Tyrol, and Trentino, promoting scientific excellence and cross-border cooperation in the Alpine region.",
    }

    print(f"Downloading news data from: {list_url}")
    try:
        res = requests.get(list_url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        news_items = []
        
        # Look for the link numbers
        links = [a for a in soup.find_all('a', href=True) if '/en/news/' in a['href'] and any(c.isdigit() for c in a['href'])]
        
        for a in links[:6]:
            title = a.get_text(strip=True)
            href = a['href']
            id_news = "".join(filter(str.isdigit, href))
            url = href if href.startswith('http') else f"https://www.unitn.it{href}"
            
            # If we have the content on the mock data we insert it, otherwise we will insert a generic text
            content = PRESET_CONTENT.get(id_news, f"The full article for '{title}' is available on the UniTrento website. Please select it to see the QR code or link.")
            
            news_items.append({
                "id": id_news,
                "date": "March 2026",
                "title": title,
                "description": content[:140] + "...",
                "content": content,
                "url": url
            })
            print(f" -> Loaded news number: {id_news}")

        # Writing the data in the file
        output_path = '../tools/assets/news.json'
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(news_items, f, ensure_ascii=False, indent=4)
        
        print(f"\nDone. Wrote the file with {len(news_items)} news.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_unitn_news_hybrid()