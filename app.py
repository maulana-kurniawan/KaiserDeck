# -*- coding: utf-8 -*-
"""
Kaiser Deck v2.0 - Animal Kaiser Barcode Scanner & Deck Manager
Author: maulana-kurniawan (https://github.com/maulana-kurniawan)
Target Emulator: Play! (Namco System 147 I/O HTTP Server - Animal Kaiser)
Built with Gemini 3.8 Flash
"""

import sys
import os

# Fix Windows console UnicodeEncodeError for UTF-8 box characters
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import json
import uuid
import socket
import threading

from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory
from PIL import Image, ImageOps
# Fix Windows DLL search path for PyInstaller frozen bundle (pyzbar libiconv.dll & libzbar-64.dll)
if sys.platform == 'win32':
    frozen_base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else os.path.abspath(__file__)))
    pyzbar_dir = os.path.join(frozen_base, 'pyzbar')
    for d in [frozen_base, pyzbar_dir]:
        if os.path.exists(d):
            try:
                os.add_dll_directory(d)
            except (AttributeError, OSError):
                pass
    os.environ['PATH'] = f"{pyzbar_dir};{frozen_base};" + os.environ.get('PATH', '')

from pyzbar.pyzbar import decode
import requests
import webview
from gevent.pywsgi import WSGIServer
import fade
from colorama import init as colorama_init, Fore, Style

# Support PyInstaller standalone frozen bundle
if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    BUNDLE_DIR = sys._MEIPASS
    DATA_DIR = os.path.dirname(sys.executable)
else:
    # Running in normal Python environment
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = BUNDLE_DIR

STATIC_DIR = os.path.join(BUNDLE_DIR, 'static')
TEMPLATES_DIR = os.path.join(BUNDLE_DIR, 'templates')
IMAGES_DIR = os.path.join(DATA_DIR, 'images')

os.makedirs(IMAGES_DIR, exist_ok=True)

app = Flask(__name__, static_folder=STATIC_DIR, template_folder=TEMPLATES_DIR)
host = '127.0.0.1'
CARDS_PER_PAGE = 12  # Maksimal 12 kartu per halaman (4 kolom x 3 baris)


def get_data_filepath(filename='data.json'):
    return os.path.join(DATA_DIR, filename)


def baca_data(nama_file='data.json'):
    filepath = get_data_filepath(nama_file)
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def tulis_data_animal(data, nama_file='data.json'):
    filepath = get_data_filepath(nama_file)
    with open(filepath, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4)


@app.route('/barcode', methods=['POST'])
def scan_barcode():
    """Extract barcode text from uploaded image."""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        image_file = request.files['image']
        image = Image.open(image_file)
        barcodes = decode(image)
        if barcodes:
            barcode_data = barcodes[0].data.decode('utf-8')
            return barcode_data
        return ''
    except Exception as e:
        print('Error in /barcode:', e)
        return 'Internal Server Error', 500


TYPE_ORDER = {'animal': 0, 'strong': 1, 'miracle': 2}
RARITY_ORDER = {
    'kaiser rare': 0,
    'kaiser': 0,
    'ultra rare': 1,
    'ultra': 1,
    'gold rare': 2,
    'gold': 2,
    'silver rare': 3,
    'silver': 3,
    'bronze rare': 4,
    'bronze': 4,
    'normal': 5,
}


def get_type_rank(card_type):
    """Rank card category: Animal > Strong > Miracle."""
    if not card_type:
        return 99
    return TYPE_ORDER.get(str(card_type).strip().lower(), 99)


def get_rarity_rank(rarity):
    """Rank card rarity from rarest to most common: Kaiser > Ultra > Gold > Silver > Bronze > Normal."""
    if not rarity:
        return 99
    return RARITY_ORDER.get(str(rarity).strip().lower(), 99)


@app.route('/cards')
@app.route('/collection')
def cards():
    """Card deck catalog with unified view & type filter."""
    filter_type = request.args.get('type', 'All').strip()
    page = request.args.get('page', 1, type=int)
    query = request.args.get('query', '').strip()
    all_cards = baca_data('data.json')

    # Apply search query filter
    if query:
        filtered = [c for c in all_cards if query.lower() in c.get('nama', '').lower()]
    else:
        filtered = list(all_cards)

    # Apply type filter (All vs Animal vs Strong vs Miracle)
    if filter_type.lower() != 'all':
        filtered = [c for c in filtered if c.get('type', '').strip().lower() == filter_type.lower()]
        # Auto-sort per category:
        # 1. Rarity (Kaiser Rare > Ultra Rare > Gold > Silver > Bronze > Normal)
        # 2. Name ascending (A-Z)
        # 3. Newest card ID first
        filtered.sort(
            key=lambda c: (
                get_rarity_rank(c.get('rarity', '')),
                str(c.get('nama', '')).strip().lower(),
                -c.get('id', 0)
            )
        )
    else:
        # Default view combines all cards auto-sorted by:
        # 1. Type: Animal > Strong > Miracle
        # 2. Rarity: Kaiser Rare > Ultra Rare > Gold > Silver > Bronze > Normal
        # 3. Name ascending (A-Z)
        # 4. Newest card ID first
        filtered.sort(
            key=lambda c: (
                get_type_rank(c.get('type', '')),
                get_rarity_rank(c.get('rarity', '')),
                str(c.get('nama', '')).strip().lower(),
                -c.get('id', 0)
            )
        )

    total_items = len(filtered)
    total_pages = (total_items + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE or 1
    start_index = (page - 1) * CARDS_PER_PAGE
    end_index = start_index + CARDS_PER_PAGE
    collection = filtered[start_index:end_index]

    return render_template(
        'collection.html',
        collection=collection,
        filter_type=filter_type,
        total_pages=total_pages,
        current_page=page,
        query=query
    )


@app.route('/animal-card')
def collection_animal():
    return redirect(url_for('cards', type='Animal', query=request.args.get('query', '')))


@app.route('/strong-card')
def collection_strong():
    return redirect(url_for('cards', type='Strong', query=request.args.get('query', '')))


@app.route('/miracle-card')
def collection_miracle():
    return redirect(url_for('cards', type='Miracle', query=request.args.get('query', '')))



@app.route('/images/<path:filename>')
def images(filename):
    """Serve card images from DATA_DIR/images."""
    return send_from_directory(IMAGES_DIR, filename)


VALID_RARITIES = {
    'Animal': ['Normal', 'Bronze Rare', 'Silver Rare', 'Gold Rare', 'Ultra Rare', 'Kaiser Rare'],
    'Strong': ['Normal', 'Bronze Rare', 'Silver Rare', 'Gold Rare'],
    'Miracle': ['Normal', 'Bronze Rare', 'Silver Rare', 'Gold Rare']
}


def sanitize_card_rarity(card_type, card_rarity):
    """Enforce rarity constraint: Strong & Miracle cards have NO Ultra Rare or Kaiser Rare."""
    allowed = VALID_RARITIES.get(card_type, VALID_RARITIES['Animal'])
    if card_rarity in allowed:
        return card_rarity
    return 'Gold Rare' if card_rarity in ('Ultra Rare', 'Kaiser Rare') else 'Normal'


def process_and_save_card_image(uploaded_file):
    """Resize card image proportionally to fit within 1080x1920 pixels preserving aspect ratio, and save as JPEG (.jpg)."""
    try:
        image = Image.open(uploaded_file)
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        # Convert transparent or palette modes to standard RGB
        if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[3])
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        max_w, max_h = 1080, 1920
        scale = min(max_w / image.width, max_h / image.height)
        new_w = max(1, int(round(image.width * scale)))
        new_h = max(1, int(round(image.height * scale)))

        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
        resized_image = image.resize((new_w, new_h), resample_filter)

        filename = f"{uuid.uuid4()}.jpg"
        filepath = os.path.join(IMAGES_DIR, filename)
        resized_image.save(filepath, format='JPEG', quality=90, optimize=True)
        return filename
    except Exception as e:
        print('Error processing card image:', e)
        try:
            filename = f"{uuid.uuid4()}.jpg"
            uploaded_file.seek(0)
            uploaded_file.save(os.path.join(IMAGES_DIR, filename))
            return filename
        except Exception:
            return None


@app.route('/tambah', methods=['POST'])
def tambah():
    """Add new card."""
    product_data = baca_data('data.json')
    if not product_data:
        new_id = 1
    else:
        new_id = max(produk.get('id', 0) for produk in product_data) + 1

    card_type = request.form.get('type', 'Animal').strip()
    if card_type not in ('Animal', 'Strong', 'Miracle'):
        card_type = 'Animal'
    card_rarity = sanitize_card_rarity(card_type, request.form.get('rarity', 'Normal').strip())

    new_animal = {
        'id': new_id,
        'nama': request.form.get('nama', '').strip(),
        'rarity': card_rarity,
        'type': card_type,
        'barcode': request.form.get('barcode', '').strip()
    }

    if 'gambar' in request.files:
        gambar = request.files['gambar']
        if gambar and gambar.filename != '':
            saved_filename = process_and_save_card_image(gambar)
            if saved_filename:
                new_animal['gambar'] = saved_filename

    product_data.append(new_animal)
    tulis_data_animal(product_data)

    card_type = request.form.get('type', 'All')
    return redirect(url_for('cards', type=card_type))


@app.route('/edit', methods=['POST'])
def edit():
    """Edit existing card."""
    animal_data = baca_data('data.json')
    item_to_update = None
    target_id = request.form.get('id')

    for item in animal_data:
        if str(item.get('id')) == str(target_id):
            card_type = request.form.get('type', item.get('type', 'Animal')).strip()
            if card_type not in ('Animal', 'Strong', 'Miracle'):
                card_type = item.get('type', 'Animal')
            card_rarity = sanitize_card_rarity(card_type, request.form.get('rarity', item.get('rarity', 'Normal')).strip())

            item['nama'] = request.form.get('nama', item.get('nama')).strip()
            item['rarity'] = card_rarity
            item['type'] = card_type
            item['barcode'] = request.form.get('barcode', item.get('barcode')).strip()
            item_to_update = item
            break

    if 'gambar' in request.files:
        gambar = request.files['gambar']
        if gambar and gambar.filename != '':
            if item_to_update and 'gambar' in item_to_update:
                old_file = os.path.join(IMAGES_DIR, item_to_update['gambar'])
                if os.path.exists(old_file):
                    try:
                        os.remove(old_file)
                    except OSError:
                        pass
            saved_filename = process_and_save_card_image(gambar)
            if saved_filename and item_to_update:
                item_to_update['gambar'] = saved_filename

    tulis_data_animal(animal_data)

    card_type = request.form.get('type', 'All')
    return redirect(url_for('cards', type=card_type))


@app.route('/hapus/<int:id>', methods=['POST'])
def hapus(id):
    """Delete card."""
    animal_data = baca_data('data.json')
    animal = next((a for a in animal_data if a.get('id') == id), None)
    if animal:
        if 'gambar' in animal:
            img_path = os.path.join(IMAGES_DIR, animal['gambar'])
            if os.path.exists(img_path):
                try:
                    os.remove(img_path)
                except OSError:
                    pass
        animal_data.remove(animal)
        tulis_data_animal(animal_data)
        return jsonify({'message': 'Card successfully deleted'}), 200
    return jsonify({'message': 'Card not found'}), 404


@app.route('/baca/<int:id>', methods=['POST', 'GET'])
def baca(id):
    """Fetch card JSON details by ID."""
    animal_data = baca_data('data.json')
    animal = next((a for a in animal_data if a.get('id') == id), None)
    if animal:
        return jsonify(animal)
    return jsonify({'message': 'Card not found'}), 404


@app.route('/')
def index():
    """Main dashboard & barcode scanner."""
    return render_template('upload.html', ip_add=host)


@app.route('/test-connect', methods=['POST', 'GET'])
def connect():
    """Test connection to Play! emulator Namco System 147 I/O HTTP server."""
    try:
        target_ip = request.host.split(':')[0]
        response = requests.head(f'http://{target_ip}:9876/sys147/barcode', timeout=0.15)
        if response.status_code == 200:
            return 'Server Play! Active'
        return f'Server Play! status: {response.status_code}'
    except Exception:
        return 'Play! I/O HTTP Server is offline.'


@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload barcode picture, decode, and send to Play! emulator."""
    try:
        if 'image' not in request.files:
            return 'No image file uploaded', 400
        image_file = request.files['image']
        image = Image.open(image_file)
        barcodes = decode(image)
        if barcodes:
            barcode_data = barcodes[0].data.decode('utf-8')
            print('Barcode data scanned:', barcode_data)
            try:
                target_ip = request.host.split(':')[0]
                response = requests.head(
                    f'http://{target_ip}:9876/sys147/barcode',
                    data=barcode_data,
                    timeout=0.15
                )
                if response.status_code == 200:
                    return 'Card successfully sent'
                return f'Emulator response: {response.status_code}'
            except Exception:
                return 'Barcode detected, but Play! I/O HTTP Server is offline.'
        return 'No barcode found in image'
    except Exception as e:
        print('Error in /upload:', e)
        return 'Internal Server Error: ' + str(e), 500



@app.route('/scan-barcode-image', methods=['POST'])
def scan_barcode_image():
    """Decode barcode from uploaded image file and return extracted code as JSON."""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'message': 'No image file uploaded.'}), 400
        image_file = request.files['image']
        image = Image.open(image_file)
        barcodes = decode(image)
        if barcodes:
            barcode_data = barcodes[0].data.decode('utf-8')
            return jsonify({'success': True, 'barcode': barcode_data})
        return jsonify({'success': False, 'message': 'No barcode detected in image.'})
    except Exception as e:
        print('Error in /scan-barcode-image:', e)
        return jsonify({'success': False, 'message': f'Failed to process image: {str(e)}'}), 500

@app.route('/send-barcode', methods=['POST'])
def send_barcode():
    """Send text barcode to Play! emulator."""
    barcode = request.form.get('barcode', '').strip()
    card_name = request.form.get('card_name', 'Card').strip()
    if not barcode:
        return jsonify({'success': False, 'message': 'Barcode cannot be empty'}), 400
    try:
        target_ip = request.host.split(':')[0]
        response = requests.head(
            f'http://{target_ip}:9876/sys147/barcode',
            data=barcode,
            timeout=0.15
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': f'{card_name} successfully sent'})
        return jsonify({'success': False, 'message': f'Emulator response code: {response.status_code}'})
    except Exception:
        return jsonify({'success': False, 'message': 'Play! I/O HTTP Server is offline.'})


def get_ip_address():
    """Retrieve local network IPv4 address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def startserver():
    http_server = WSGIServer(('0.0.0.0', 5000), app)
    http_server.serve_forever()


if __name__ == '__main__':
    banner = r"""
  ██╗  ██╗ █████╗ ██╗███████╗███████╗██████╗     ██████╗ ███████╗ ██████╗██╗  ██╗
  ██║ ██╔╝██╔══██╗██║██╔════╝██╔════╝██╔══██╗    ██╔══██╗██╔════╝██╔════╝██║ ██╔╝
  █████╔╝ ███████║██║███████╗█████╗  ██████╔╝    ██║  ██║█████╗  ██║     █████╔╝ 
  ██╔═██╗ ██╔══██║██║╚════██║██╔══╝  ██╔══██╗    ██║  ██║██╔══╝  ██║     ██╔═██╗ 
  ██║  ██╗██║  ██║██║███████║███████╗██║  ██║    ██████╔╝███████╗╚██████╗██║  ██╗
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝
"""
    try:
        faded_text = fade.greenblue(banner)
        print(faded_text)
    except Exception:
        print("=== KAISER DECK 2.0 ===")

    colorama_init(autoreset=True)
    print(f"* {Fore.LIGHTCYAN_EX}{Style.BRIGHT}Kaiser Deck {Fore.WHITE}2.0{Style.RESET_ALL}")

    ip = get_ip_address()
    if ip and ip != '127.0.0.1':
        print(f"* Running on {Fore.LIGHTGREEN_EX}{Style.BRIGHT}http://{ip}:5000{Style.RESET_ALL}")
        host = ip
    else:
        print(f"* Running on {Fore.LIGHTGREEN_EX}{Style.BRIGHT}http://127.0.0.1:5000{Style.RESET_ALL}")
        host = '127.0.0.1'

    print(
        f"* Author: {Fore.LIGHTYELLOW_EX}{Style.BRIGHT}maulana-kurniawan {Fore.WHITE}{Style.BRIGHT}[{Fore.LIGHTGREEN_EX}{Style.BRIGHT}https://github.com/maulana-kurniawan{Fore.WHITE}{Style.BRIGHT}]{Style.RESET_ALL}"
    )

    t = threading.Thread(target=startserver)
    t.daemon = True
    t.start()

    if '--no-gui' in sys.argv or '--headless' in sys.argv:
        print("* Running in headless web mode. Press Ctrl+C to stop.")
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("* Stopping server.")
    else:
        try:
            webview.create_window('Kaiser Deck 2.0 - by maulana-kurniawan', app, width=1280, height=800)
            webview.start()
        except Exception as e:
            print(f"* Webview GUI notice: {e}. Running in web server mode.")
            try:
                import time
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
