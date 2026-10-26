<div align="center">
  <img src="static/img/logo.png" width="130" alt="Kaiser Deck Logo" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
  <h1>🎴 Kaiser Deck</h1>
  <p><strong>Arcade Barcode I/O & Deck Management Companion for Animal Kaiser on Play! Emulator</strong></p>
</div>

A card deck manager, 1D barcode generator, and scanning companion for **Animal Kaiser** on the **Play! PlayStation 2 / Namco System 147 Emulator**.

- **Author / Maintainer:** [maulana-kurniawan](https://github.com/maulana-kurniawan)
- **Credit & Original Source:** Built upon the original [Card-Collections](https://github.com/Bebeq/Card-Collections) by **[Bebeq](https://github.com/Bebeq)**.
- **Development:** *Built with* **Gemini 3.8 Flash** ⚡

---

## What's New & Enhancements

1. **New Design:** Clean and modern dark interface.
2. **Unified Card Catalog & Filters:** View all cards sorted by type (Animal > Strong > Miracle), rarity, and alphabetical order, with type filters and search.
3. **Card Rarities:** Normal, Bronze Rare, Silver Rare, Gold Rare, Ultra Rare, and Kaiser Rare.
4. **Barcode Scanner from Image:** Scan barcodes directly from card images or photos.
5. **Standalone Executable:** Portable Windows binary without requiring manual Python installation.

---

## How to Run

### 1. Run from Source Code
Double-click `run.bat` or run via terminal:
```bash
pip install -r requirements.txt
python app.py
```
To run in web browser mode without the native desktop window:
```bash
python app.py --no-gui
```

---

## Compiling to Standalone `.exe`

To compile into a single portable binary `KaiserDeck.exe`:
1. Double-click `build.bat`
2. The executable output will be located at:
   ```text
   dist/
   └── KaiserDeck.exe
   ```

> [!NOTE]
> `data.json` and `images/` folder will be auto-generated when you add your first card through the user interface.

---

## Automated GitHub Releases (CI/CD)

Every push to `main` automatically triggers GitHub Actions to build and release the latest Windows executable under the **Releases** tab:
- **`KaiserDeck.exe`**: Ready-to-use standalone executable for Windows.

---

## License

This project is licensed under the **[MIT License](LICENSE)** &copy; 2026 [maulana-kurniawan](https://github.com/maulana-kurniawan).
