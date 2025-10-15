import os
from telethon.sync import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import User, Chat, Channel

API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
SESSION_STRING = os.getenv("TELEGRAM_SESSION")

# Validasi kredensial
if not all([API_ID, API_HASH, SESSION_STRING]):
    platform = os.getenv('PLATFORM', 'webchat').lower()
    if platform in ['telegram']:
        raise ValueError("API_ID, API_HASH, atau TELEGRAM_SESSION tidak ditemukan. Pastikan sudah diatur di GitHub Secrets atau environment variables lokal.")

# Inisialisasi client menggunakan StringSession
client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH) if all([API_ID, API_HASH, SESSION_STRING]) else None

async def send_message_to_bot(bot_username, text):
    """Mengirim pesan ke bot target."""
    if not client:
        print("Telegram client tidak terinisialisasi.")
        return False
    try:
        await client.send_message(bot_username, text)
        print(f"Pesan terkirim ke '{bot_username}': {text}")
        return True
    except Exception as e:
        print(f"Error saat mengirim pesan ke '{bot_username}': {e}")
        return False

async def get_latest_message_from_bot(bot_username):
    """Mendapatkan pesan terakhir dari bot target."""
    if not client:
        print("Telegram client tidak terinisialisasi.")
        return None
    try:
        messages = await client.get_messages(bot_username, limit=1)
        if messages:
            latest_message = messages[0]
            print(f"Pesan diterima dari '{bot_username}': {latest_message.text}")
            return latest_message.text
        return "Tidak ada pesan ditemukan."
    except Exception as e:
        print(f"Error saat mengambil pesan dari '{bot_username}': {e}")
