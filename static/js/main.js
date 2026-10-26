// Kaiser Deck Main Client JS

document.addEventListener('DOMContentLoaded', () => {
    initEmulatorStatusChecker();
    initCameraScanner();
    initDropzone();
    initManualBarcodeForm();
    renderVisualBarcodes();

    // Initialize Add Card modal type & rarity
    const addTypeInput = document.getElementById('addType');
    if (addTypeInput) {
        updateRarityOptions('add', addTypeInput.value || 'Animal');
    }
});

// Global Toast Notification Helper (Material 3)
let toastTimeout = null;

function showToast(message, type = 'auto') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Support legacy boolean argument (isError)
    if (type === true) type = 'error';
    if (type === false) type = 'auto';

    // Auto-detect message severity if type is 'auto'
    const lower = String(message).toLowerCase();
    if (type === 'auto') {
        if (lower.includes('offline') || lower.includes('not detected') || lower.includes('queued') || lower.includes('inactive') || lower.includes('tidak terdeteksi') || lower.includes('tetapi i/o')) {
            type = 'warning';
        } else if (lower.includes('fail') || lower.includes('error') || lower.includes('not found') || lower.includes('unable') || lower.includes('cannot') || lower.includes('gagal')) {
            type = 'error';
        } else if (lower.includes('success') || lower.includes('sent') || lower.includes('detected') || lower.includes('deleted') || lower.includes('saved') || lower.includes('berhasil') || lower.includes('terdeteksi')) {
            type = 'success';
        } else {
            type = 'info';
        }
    }

    let icon = '⚡';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
        <span class="m3-toast-icon noto-emoji">${icon}</span>
        <span class="m3-toast-text">${message}</span>
        <button type="button" class="m3-toast-close" onclick="hideToast()" aria-label="Tutup">✕</button>
    `;

    toast.className = `m3-snackbar toast show ${type}`;

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        hideToast();
    }, 4500);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.remove('show');
}

// Scan Barcode from Image File (for Add/Edit Card Modal)
function scanBarcodeForInput(fileInput, targetInputId) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    showToast('Scanning barcode from image...', 'info');

    const formData = new FormData();
    formData.append('image', file);

    fetch('/scan-barcode-image', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.barcode) {
            const target = document.getElementById(targetInputId);
            if (target) {
                target.value = data.barcode;
                target.focus();
            }
            showToast('Barcode successfully detected', 'success');
        } else {
            showToast(data.message || 'No barcode detected in image.', 'warning');
        }
    })
    .catch(err => {
        showToast('Failed to process image: ' + (err.message || err), 'error');
    })
    .finally(() => {
        fileInput.value = '';
    });
}

// Handle card image selection: resize proportionally to max 1080x1920 JPG preserving aspect ratio and auto-detect barcode
async function handleCardImageSelection(fileInput, targetInputId) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    if (!file.type || !file.type.startsWith('image/')) {
        autoScanFromCardPhoto(fileInput, targetInputId);
        return;
    }

    try {
        const resizedJpgFile = await resizeImageTo1080x1920Jpg(file);
        if (window.DataTransfer) {
            const dt = new DataTransfer();
            dt.items.add(resizedJpgFile);
            fileInput.files = dt.files;
        }
        showToast('Image selected successfully', 'success');
    } catch (err) {
        console.warn('Client-side resize notice:', err);
    }

    // Auto-detect barcode from the selected card photo
    autoScanFromCardPhoto(fileInput, targetInputId);
}

function resizeImageTo1080x1920Jpg(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 1080;
                const maxHeight = 1920;
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                const targetWidth = Math.max(1, Math.round(img.width * scale));
                const targetHeight = Math.max(1, Math.round(img.height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                // Solid white background in case source image has transparency
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                // High quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Render image resized proportionally without distorting aspect ratio
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const baseName = (file.name || 'card_photo').replace(/\.[^/.]+$/, "");
                        const jpgFile = new File([blob], `${baseName}.jpg`, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(jpgFile);
                    } else {
                        reject(new Error('Canvas toBlob failed'));
                    }
                }, 'image/jpeg', 0.92);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Auto-scan barcode when picking card photo if barcode field is empty
function autoScanFromCardPhoto(fileInput, targetInputId) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const target = document.getElementById(targetInputId);
    if (target && target.value.trim() !== '') return; // Don't overwrite existing barcode

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('image', file);

    fetch('/scan-barcode-image', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.barcode) {
            if (target) {
                target.value = data.barcode;
            }
            showToast('Barcode automatically detected from card photo', 'success');
        }
    })
    .catch(() => {});
}

// 1. Emulator Status Checker
function checkEmulatorStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusLabel = document.getElementById('statusLabel');
    if (!statusDot || !statusLabel) return;

    statusLabel.textContent = 'Checking...';
    fetch('/test-connect', { method: 'POST' })
        .then(res => res.text())
        .then(text => {
            if (text.includes('Active')) {
                statusDot.className = 'status-dot online';
                statusLabel.textContent = 'Play! Active';
            } else {
                statusDot.className = 'status-dot offline';
                statusLabel.textContent = 'Play! Offline';
            }
        })
        .catch(() => {
            statusDot.className = 'status-dot offline';
            statusLabel.textContent = 'Play! Offline';
        });
}

function initEmulatorStatusChecker() {
    checkEmulatorStatus();
    const btn = document.getElementById('btnCheckStatus');
    if (btn) btn.addEventListener('click', checkEmulatorStatus);
    // Poll every 15s
    setInterval(checkEmulatorStatus, 15000);
}

// 2. Camera Scanner
let videoStream = null;
let scanningInterval = null;

function initCameraScanner() {
    const btnStart = document.getElementById('btnStartCamera');
    const btnStop = document.getElementById('btnStopCamera');
    const video = document.getElementById('cameraVideo');
    const overlay = document.getElementById('scanOverlay');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (!btnStart || !video) return;

    btnStart.addEventListener('click', async () => {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            video.srcObject = videoStream;
            video.play();
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-flex';
            if (overlay) overlay.classList.add('active');
            if (placeholder) placeholder.style.display = 'none';

            // Start capture frames & post to /barcode
            startFrameScanning(video);
        } catch (err) {
            console.error('Camera access error:', err);
            showToast('Unable to access camera: ' + err.message, 'error');
        }
    });

    if (btnStop) {
        btnStop.addEventListener('click', () => {
            stopCamera();
        });
    }
}

function stopCamera() {
    const btnStart = document.getElementById('btnStartCamera');
    const btnStop = document.getElementById('btnStopCamera');
    const video = document.getElementById('cameraVideo');
    const overlay = document.getElementById('scanOverlay');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
    }
    if (video) video.srcObject = null;
    if (btnStart) btnStart.style.display = 'inline-flex';
    if (btnStop) btnStop.style.display = 'none';
    if (overlay) overlay.classList.remove('active');
    if (placeholder) placeholder.style.display = 'flex';
}

function startFrameScanning(video) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let isProcessing = false;

    scanningInterval = setInterval(() => {
        if (isProcessing || !video.videoWidth) return;
        isProcessing = true;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (!blob) {
                isProcessing = false;
                return;
            }
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');

            fetch('/barcode', {
                method: 'POST',
                body: formData
            })
            .then(res => res.text())
            .then(barcode => {
                isProcessing = false;
                if (barcode && barcode.trim() !== '') {
                    showToast('Barcode detected', 'info');
                    sendCardBarcode(barcode.trim(), 'Kartu Kamera');
                    // Brief pause to avoid duplicate scans
                    stopCamera();
                }
            })
            .catch(() => {
                isProcessing = false;
            });
        }, 'image/jpeg', 0.85);
    }, 1200);
}

// 3. Dropzone & File Input
function initDropzone() {
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');

    if (!fileInput || !dropzone) return;

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
}

function handleFileUpload(file) {
    showToast('Scanning barcode from image...', 'info');
    const formData = new FormData();
    formData.append('image', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.text())
    .then(result => {
        showToast(result);
    })
    .catch(err => {
        showToast('Failed to process image: ' + err, 'error');
    });
}

// 4. Manual Barcode Form
function initManualBarcodeForm() {
    const form = document.getElementById('manualBarcodeForm');
    const input = document.getElementById('barcodeInput');
    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const barcode = input.value.trim();
        if (!barcode) return;
        sendCardBarcode(barcode, 'Manual');
    });
}

// 5. Send Barcode directly to Play! Emulator (Supports DOM element or string with safe backslash handling)
function sendCardBarcode(barcodeOrElement, cardName = 'Card') {
    let barcode = '';
    let displayName = cardName;

    if (barcodeOrElement instanceof Element || (typeof barcodeOrElement === 'object' && barcodeOrElement && barcodeOrElement.getAttribute)) {
        barcode = barcodeOrElement.getAttribute('data-barcode') || '';
        displayName = barcodeOrElement.getAttribute('data-card-name') || cardName;
    } else {
        barcode = String(barcodeOrElement || '');
    }

    if (!barcode) {
        showToast('Barcode data is empty', 'warning');
        return;
    }

    displayName = (displayName && displayName !== 'Kartu' && displayName !== 'Card') ? displayName : 'Card';
    showToast('Sending ' + displayName + ' to emulator...', 'info');
    const formData = new FormData();
    formData.append('barcode', barcode);
    formData.append('card_name', displayName);

    fetch('/send-barcode', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || (displayName + ' successfully sent'), 'success');
        } else {
            showToast(data.message || 'Play! I/O HTTP Server is offline.', 'warning');
        }
    })
    .catch(err => {
        showToast('Emulator connection failed: ' + (err.message || err), 'error');
    });
}

// 6. Modal Functions (Add / Edit / Delete)
const CARD_TYPE_META = {
    Animal: { label: 'Animal', icon: '🦁', cssClass: 'chip-animal' },
    Strong: { label: 'Strong', icon: '⚡', cssClass: 'chip-strong' },
    Miracle: { label: 'Miracle', icon: '🌟', cssClass: 'chip-miracle' }
};

const RARITY_META = {
    'Normal': { label: 'Normal', icon: '⚪', cssClass: 'rarity-normal' },
    'Bronze Rare': { label: 'Bronze Rare', icon: '🥉', cssClass: 'rarity-bronze-rare' },
    'Silver Rare': { label: 'Silver Rare', icon: '🥈', cssClass: 'rarity-silver-rare' },
    'Gold Rare': { label: 'Gold Rare', icon: '🥇', cssClass: 'rarity-gold-rare' },
    'Ultra Rare': { label: 'Ultra Rare', icon: '🌌', cssClass: 'rarity-ultra-rare' },
    'Kaiser Rare': { label: 'Kaiser Rare', icon: '👑', cssClass: 'rarity-kaiser-rare' }
};

// Rarity Presets: Strong and Miracle have NO Ultra Rare or Kaiser Rare
const RARITY_PRESETS = {
    Animal: [
        'Normal',
        'Bronze Rare',
        'Silver Rare',
        'Gold Rare',
        'Ultra Rare',
        'Kaiser Rare'
    ],
    Strong: [
        'Normal',
        'Bronze Rare',
        'Silver Rare',
        'Gold Rare'
    ],
    Miracle: [
        'Normal',
        'Bronze Rare',
        'Silver Rare',
        'Gold Rare'
    ]
};

function toggleChipDropdown(prefix, target = 'Type') {
    const dropdown = document.getElementById(prefix + target + 'Dropdown');
    const trigger = document.getElementById(prefix + target + 'Trigger');
    if (!dropdown) return;
    const isCurrentlyOpen = dropdown.classList.contains('open');

    // Close any other open chip dropdowns first
    document.querySelectorAll('.m3-chip-select-dropdown.open').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('open');
            const otherTrigger = d.querySelector('.m3-chip-dropdown-trigger');
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
    });

    dropdown.classList.toggle('open', !isCurrentlyOpen);
    if (trigger) trigger.setAttribute('aria-expanded', !isCurrentlyOpen ? 'true' : 'false');
}

function selectCardType(prefix, type, updateRarity = true) {
    const validTypes = ['Animal', 'Strong', 'Miracle'];
    const cardType = validTypes.includes(type) ? type : 'Animal';
    const meta = CARD_TYPE_META[cardType];

    // Update hidden input
    const hiddenInput = document.getElementById(prefix + 'Type');
    if (hiddenInput) {
        hiddenInput.value = cardType;
    }

    // Update trigger button class & text
    const trigger = document.getElementById(prefix + 'TypeTrigger');
    if (trigger) {
        trigger.className = 'm3-chip-dropdown-trigger ' + meta.cssClass;
        trigger.setAttribute('aria-expanded', 'false');
        const iconEl = trigger.querySelector('.chip-icon');
        const textEl = trigger.querySelector('.chip-text');
        if (iconEl) iconEl.textContent = meta.icon;
        if (textEl) textEl.textContent = meta.label;
    }

    // Update active highlight in menu items
    const menu = document.getElementById(prefix + 'TypeMenu');
    if (menu) {
        const items = menu.querySelectorAll('.m3-chip-dropdown-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.classList.contains(meta.cssClass));
        });
    }

    // Close dropdown
    const dropdown = document.getElementById(prefix + 'TypeDropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }

    // Dynamically update rarity options (excludes Ultra/Kaiser for Strong & Miracle)
    if (updateRarity) {
        updateRarityOptions(prefix, cardType);
    }
}

function selectCardRarity(prefix, rarity) {
    const meta = RARITY_META[rarity] || RARITY_META['Normal'];
    const rarityVal = meta.label;

    // Update hidden input
    const hiddenInput = document.getElementById(prefix + 'Rarity');
    if (hiddenInput) {
        hiddenInput.value = rarityVal;
    }

    // Get current card type
    const typeInput = document.getElementById(prefix + 'Type');
    const currentType = typeInput ? typeInput.value.toLowerCase() : 'animal';

    // Update trigger button class, icon & text
    const trigger = document.getElementById(prefix + 'RarityTrigger');
    if (trigger) {
        Object.values(RARITY_META).forEach(m => trigger.classList.remove(m.cssClass));
        trigger.classList.remove('type-animal', 'type-strong', 'type-miracle');
        trigger.classList.add(meta.cssClass);
        if (rarityVal === 'Normal') {
            trigger.classList.add(`type-${currentType}`);
        }
        trigger.setAttribute('aria-expanded', 'false');
        const iconEl = trigger.querySelector('.chip-icon');
        const textEl = trigger.querySelector('.chip-text');
        if (iconEl) iconEl.textContent = meta.icon;
        if (textEl) textEl.textContent = meta.label;
    }

    // Update active highlight in menu items
    const menu = document.getElementById(prefix + 'RarityMenu');
    if (menu) {
        const items = menu.querySelectorAll('.m3-chip-dropdown-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.classList.contains(meta.cssClass));
        });
    }

    // Close dropdown
    const dropdown = document.getElementById(prefix + 'RarityDropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
}

function updateRarityOptions(prefix, selectedType, desiredRarity) {
    const allowed = RARITY_PRESETS[selectedType] || RARITY_PRESETS.Animal;
    const typeCls = `type-${selectedType.toLowerCase()}`;
    const hiddenInput = document.getElementById(prefix + 'Rarity');
    const currentVal = desiredRarity !== undefined ? desiredRarity : (hiddenInput ? hiddenInput.value : 'Normal');

    // Fallback if previous selection was Ultra/Kaiser Rare and not allowed
    let targetVal = currentVal;
    if (!allowed.includes(targetVal)) {
        targetVal = allowed.includes('Gold Rare') ? 'Gold Rare' : allowed[0];
    }

    // Update hidden input value
    if (hiddenInput) {
        hiddenInput.value = targetVal;
    }

    // Update trigger button
    const targetMeta = RARITY_META[targetVal] || RARITY_META['Normal'];
    const trigger = document.getElementById(prefix + 'RarityTrigger');
    if (trigger) {
        Object.values(RARITY_META).forEach(m => trigger.classList.remove(m.cssClass));
        trigger.classList.remove('type-animal', 'type-strong', 'type-miracle');
        trigger.classList.add(targetMeta.cssClass);
        if (targetVal === 'Normal') {
            trigger.classList.add(typeCls);
        }
        const iconEl = trigger.querySelector('.chip-icon');
        const textEl = trigger.querySelector('.chip-text');
        if (iconEl) iconEl.textContent = targetMeta.icon;
        if (textEl) textEl.textContent = targetMeta.label;
    }

    // Rebuild options in custom dropdown menu
    const menu = document.getElementById(prefix + 'RarityMenu');
    if (menu) {
        menu.innerHTML = '';
        allowed.forEach(r => {
            const meta = RARITY_META[r] || RARITY_META['Normal'];
            const isSelected = (r === targetVal);
            const extraTypeCls = (r === 'Normal') ? ` ${typeCls}` : '';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `m3-chip-dropdown-item ${meta.cssClass}${extraTypeCls} ${isSelected ? 'selected' : ''}`;
            btn.onclick = () => selectCardRarity(prefix, r);

            const iconSpan = document.createElement('span');
            iconSpan.className = 'noto-emoji';
            iconSpan.textContent = meta.icon;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = meta.label;

            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'item-badge';
            badgeSpan.textContent = '✓';

            btn.appendChild(iconSpan);
            btn.appendChild(nameSpan);
            btn.appendChild(badgeSpan);
            menu.appendChild(btn);
        });
    }
}

function openAddModal() {
    const modal = document.getElementById('addModal');
    if (!modal) return;

    // Sync card type chip & dynamic rarity
    const hiddenType = document.getElementById('addType');
    const initialType = (hiddenType && hiddenType.value) ? hiddenType.value : 'Animal';
    selectCardType('add', initialType, false);
    updateRarityOptions('add', initialType);

    modal.classList.add('active');
}

function closeAddModal() {
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.classList.remove('active');
        const tDrop = document.getElementById('addTypeDropdown');
        if (tDrop) tDrop.classList.remove('open');
        const rDrop = document.getElementById('addRarityDropdown');
        if (rDrop) rDrop.classList.remove('open');
    }
}

function openEditModal(cardId) {
    const modal = document.getElementById('editModal');
    if (!modal) return;

    fetch('/baca/' + cardId, { method: 'POST' })
        .then(res => res.json())
        .then(card => {
            document.getElementById('editId').value = card.id;
            document.getElementById('editNama').value = card.nama;
            document.getElementById('editBarcode').value = card.barcode;

            // Sync Card Type chip dropdown & dynamic rarity options
            const cardType = card.type || 'Animal';
            selectCardType('edit', cardType, false);
            updateRarityOptions('edit', cardType, card.rarity);

            modal.classList.add('active');
        })
        .catch(err => {
            showToast('Failed to load card details: ' + err, 'error');
        });
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
        const tDrop = document.getElementById('editTypeDropdown');
        if (tDrop) tDrop.classList.remove('open');
        const rDrop = document.getElementById('editRarityDropdown');
        if (rDrop) rDrop.classList.remove('open');
    }
}

// Close chip dropdowns on outside click or Escape key
document.addEventListener('click', (e) => {
    if (!e.target.closest('.m3-chip-select-dropdown')) {
        document.querySelectorAll('.m3-chip-select-dropdown.open').forEach(d => {
            d.classList.remove('open');
            const trigger = d.querySelector('.m3-chip-dropdown-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.m3-chip-select-dropdown.open').forEach(d => {
            d.classList.remove('open');
            const trigger = d.querySelector('.m3-chip-dropdown-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }
});

function confirmDeleteCard(cardIdOrElement, cardName = 'Card') {
    let cardId = cardIdOrElement;
    let displayName = cardName;

    if (cardIdOrElement instanceof Element || (typeof cardIdOrElement === 'object' && cardIdOrElement && cardIdOrElement.getAttribute)) {
        cardId = cardIdOrElement.getAttribute('data-card-id');
        displayName = cardIdOrElement.getAttribute('data-card-name') || cardName;
    }

    if (confirm('Are you sure you want to delete card "' + displayName + '"?')) {
        fetch('/hapus/' + cardId, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                showToast(data.message || 'Card successfully deleted', 'success');
                const cardEl = document.getElementById('card-' + cardId);
                if (cardEl) cardEl.remove();
            })
            .catch(err => {
                showToast('Failed to delete card: ' + err, 'error');
            });
    }
}

// 7. Render Real 1D Visual Barcodes via JsBarcode
function renderVisualBarcodes() {
    if (typeof JsBarcode === 'undefined') {
        console.warn('JsBarcode library not loaded yet.');
        return;
    }
    const elements = document.querySelectorAll('.barcode-svg');
    elements.forEach(svg => {
        const rawCode = svg.getAttribute('data-barcode');
        if (!rawCode || !rawCode.trim()) return;

        const code = rawCode.trim();
        try {
            JsBarcode(svg, code, {
                format: "CODE128",
                width: 1.38,
                height: 36,
                displayValue: false, // Text is rendered cleanly underneath
                margin: 0,
                background: "transparent",
                lineColor: "#f8fafc",
                valid: function (valid) {
                    if (!valid) {
                        fallbackBarcode(svg, code);
                    }
                }
            });
        } catch (err) {
            fallbackBarcode(svg, code);
        }
    });
}

function fallbackBarcode(svg, code) {
    try {
        // Fallback: strip any non-standard symbols and render Code 128
        const cleanCode = code.replace(/[^A-Za-z0-9\-\.\s]/g, '') || '1001-AK-001';
        JsBarcode(svg, cleanCode, {
            format: "CODE128",
            width: 1.4,
            height: 38,
            displayValue: false,
            margin: 0,
            background: "transparent",
            lineColor: "#f8fafc"
        });
    } catch (e) {
        console.error('Failed to render barcode:', e);
    }
}
