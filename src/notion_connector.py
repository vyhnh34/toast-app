import os
from dotenv import load_dotenv
from notion_client import Client

# Load environment variables
load_dotenv('.env.local')

notion = Client(auth=os.getenv("NOTION_API_KEY"))
DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

def get_persona(name):
    """
    Fetch a persona from Notion by name.
    Returns a dict with: name, backstory, roast_style, voice_vibe, voice_id
    """
    try:
        # Search for the persona by name
        search_result = notion.search(
            query=name,
            filter={"property": "object", "value": "page"}
        )
        
        if search_result.get('results'):
            result = search_result['results'][0]
            properties = result.get('properties', {})
            
            # Helper to safely extract text content
            def get_text(prop_name, prop_type="rich_text"):
                prop = properties.get(prop_name, {})
                if prop_type == "title":
                    items = prop.get("title", [])
                else:
                    items = prop.get("rich_text", [])
                
                if items:
                    return items[0].get("text", {}).get("content", "")
                return ""
            
            return {
                "name": get_text("Name", "title"),
                "backstory": get_text("Backstory"),
                "roast_style": get_text("Roast Style"),
                "voice_vibe": get_text("Voice Vibe"),
                "voice_id": get_text("Voice ID")
            }
        
        # Default if not found
        return {
            "name": "Helpful Assistant",
            "backstory": "A friendly and helpful AI assistant.",
            "roast_style": "Supportive and encouraging.",
            "voice_vibe": "Neutral",
            "voice_id": ""
        }
    except Exception as e:
        print(f"Error fetching persona: {e}")
        import traceback
        traceback.print_exc()
        return None

def list_all_personas():
    """List all available persona names"""
    try:
        search_result = notion.search(
            filter={"property": "object", "value": "page"}
        )
        
        personas = []
        for result in search_result.get('results', []):
            # Check if it's from our database
            parent = result.get('parent', {})
            if parent.get('type') == 'database_id':
                properties = result.get('properties', {})
                title_prop = properties.get('Name', {}).get('title', [])
                if title_prop:
                    name = title_prop[0].get('text', {}).get('content', '')
                    if name:
                        personas.append(name)
        
        return personas
    except Exception as e:
        print(f"Error listing personas: {e}")
        return []
