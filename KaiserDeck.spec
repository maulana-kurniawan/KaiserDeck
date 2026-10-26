# -*- mode: python ; coding: utf-8 -*-
import os
import sys
import pyzbar
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Locate pyzbar DLLs
pyzbar_path = os.path.dirname(pyzbar.__file__)
iconv_dll = os.path.join(pyzbar_path, 'libiconv.dll')
zbar_dll = os.path.join(pyzbar_path, 'libzbar-64.dll')

pyzbar_binaries = []
if os.path.exists(iconv_dll):
    pyzbar_binaries.append((iconv_dll, 'pyzbar'))
    pyzbar_binaries.append((iconv_dll, '.'))
if os.path.exists(zbar_dll):
    pyzbar_binaries.append((zbar_dll, 'pyzbar'))
    pyzbar_binaries.append((zbar_dll, '.'))

# Also include msvcr120.dll if available
for msvcr in [r'C:\Windows\System32\msvcr120.dll', r'C:\Windows\SysWOW64\msvcr120.dll']:
    if os.path.exists(msvcr):
        pyzbar_binaries.append((msvcr, '.'))
        pyzbar_binaries.append((msvcr, 'pyzbar'))
        break

pyzbar_datas = collect_data_files('pyzbar')

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=pyzbar_binaries,
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ] + pyzbar_datas,
    hiddenimports=[
        'gevent',
        'gevent.pywsgi',
        'greenlet',
        'engineio.async_drivers.gevent',
        'pyzbar',
        'pyzbar.pyzbar',
        'pyzbar.wrapper',
        'pyzbar.zbar_library',
        'webview',
        'clr',
        'fade',
        'colorama',
        'PIL',
        'PIL.Image',
        'jinja2',
        'flask',
        'requests',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='KaiserDeck',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='static/img/icon.ico',
)
