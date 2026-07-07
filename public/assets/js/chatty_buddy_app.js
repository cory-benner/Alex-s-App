/*
    ============================================================================
    Chatty Buddy - application logic
    ============================================================================
    This used to be one big inline <script> at the bottom of index.html, plus a
    pile of onclick="..." attributes scattered through the markup. We pulled it
    ALL out into this external file for one reason: security.

    With no inline script and no inline event handlers left in the page, the
    Content-Security-Policy can finally forbid inline script outright
    (script-src 'self', no 'unsafe-inline'). That means even if some hostile
    string ever landed in the DOM, the browser flat-out refuses to run it as code.

    Two more hardening changes live in here:
      1. We build the word tiles and the setup list with createElement +
         textContent instead of stitching innerHTML strings out of user input.
         A label, emoji, or photo can no longer carry markup into the page.
      2. Photos are validated (is_safe_image_data_url) before we ever trust one
         as an <img> source, so a tampered or imported config can't sneak a
         javascript:/http: URL or an attribute-breakout through the photo field.

    Behavior is otherwise identical to before - same views, same speech, same
    storage. Existing function/variable names were kept as-is to keep the diff
    honest; new helpers follow the verbose_snake_case house style.
    ============================================================================
*/

// The starter vocabulary a brand-new device sees before a parent customizes it.
const defaultData = {
    childName: "",
    categories: {
        iNeed: [
            { id: 1, label: "Food", emoji: "🍎", photoData: null },
            { id: 2, label: "Drink", emoji: "💧", photoData: null },
            { id: 3, label: "Help", emoji: "🆘", photoData: null },
            { id: 4, label: "Potty", emoji: "🚽", photoData: null }
        ],
        iFeel: [
            { id: 5, label: "Happy", emoji: "😃", photoData: null },
            { id: 6, label: "Sad", emoji: "😢", photoData: null },
            { id: 7, label: "Hurt", emoji: "🩹", photoData: null }
        ],
        people: [
            { id: 8, label: "Mom", emoji: "👩", photoData: null },
            { id: 9, label: "Dad", emoji: "👨", photoData: null }
        ],
        activities: [
            { id: 10, label: "Play", emoji: "🧸", photoData: null },
            { id: 11, label: "Sleep", emoji: "🛌", photoData: null },
            { id: 12, label: "Outside", emoji: "🌳", photoData: null },
            { id: 13, label: "Tablet", emoji: "📱", photoData: null }
        ]
    }
};

let appData = JSON.parse(JSON.stringify(defaultData));
let currentTempPhoto = null;

// This file loads with `defer`, so the document is fully parsed before any of
// this runs - these lookups are safe at top level.
const mainHeader = document.getElementById('mainHeader');
const bottomNav = document.getElementById('bottomNav');
const greetingText = document.getElementById('greetingText');

const views = ['loadingFallback', 'homeContainer', 'categoryView', 'setupView', 'quickTypeView'];

/*
    Single source of truth for how each category looks and reads aloud. The home
    tiles now just carry a data-category, and both the drill-down header and the
    setup list pull their title / icon / colors / spoken phrasing from here.
    (Previously this was duplicated across four long inline onclick attributes.)
*/
const category_presentation = {
    iNeed:      { title: "I Need",     icon: "front_hand",     text_class: "text-on-primary-container",  bg_class: "bg-primary-container",         speech_prefix: "I need " },
    iFeel:      { title: "I Feel",     icon: "mood",           text_class: "text-white",                 bg_class: "bg-secondary-container",       speech_prefix: "I feel " },
    people:     { title: "People",     icon: "family_history", text_class: "text-on-tertiary-container", bg_class: "bg-tertiary-container",        speech_prefix: "I want " },
    activities: { title: "Activities", icon: "smart_toy",      text_class: "text-on-surface",            bg_class: "bg-surface-container-highest", speech_prefix: "" }
};

/*
    A photo is only trusted if it's a strict base64 image data URL. Anything else
    - an http(s) URL that could beacon a child's device, a javascript: URL, or a
    value carrying quotes / angle brackets meant to break out of an attribute - is
    rejected and the word simply falls back to its emoji. The app only ever makes
    data:image/jpeg photos (via the canvas below), so this never rejects a real
    photo; it only stops a tampered or imported config from smuggling one in.
*/
const SAFE_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function is_safe_image_data_url(value) {
    return typeof value === 'string' && SAFE_IMAGE_DATA_URL_PATTERN.test(value);
}

/*
    Builds the little "photo or emoji" visual for a word and returns the element.
    If the word carries a photo we've validated, we hand back an <img> with its
    src set as a DOM property; otherwise a fallback element holding the emoji as
    plain text. Everything here is createElement + textContent + a checked src -
    never innerHTML - which is the heart of this whole refactor.
*/
function build_word_visual(word, image_class_name, fallback_element_tag, fallback_class_name) {
    if (is_safe_image_data_url(word.photoData)) {
        const photo_image = document.createElement('img');
        photo_image.src = word.photoData;
        photo_image.className = image_class_name;
        return photo_image;
    }
    const fallback_element = document.createElement(fallback_element_tag);
    fallback_element.className = fallback_class_name;
    fallback_element.textContent = word.emoji;
    return fallback_element;
}

// --- Safe Initialization ---
function initApp() {
    try {
        let savedData = null;
        // Try/Catch block prevents the white screen if local storage is blocked by strict browser policies
        try {
            savedData = localStorage.getItem('chattyBuddyData_v4');
        } catch (e) {
            console.warn("Local storage access denied by browser.", e);
        }

        if (savedData) {
            appData = JSON.parse(savedData);
            greetingText.textContent = `Hi ${appData.childName || 'Buddy'}!`;
            updateHomePreviews();
            goHome();
        } else {
            openSetup();
        }
    } catch (error) {
        console.error("Critical boot error:", error);
        // Force a safe reset if the memory was deeply corrupted
        appData = JSON.parse(JSON.stringify(defaultData));
        openSetup();
    }
}

// --- View Routing ---
function switchView(targetViewId) {
    views.forEach(viewId => {
        const el = document.getElementById(viewId);
        if (el) el.classList.add('hidden');
    });
    const targetEl = document.getElementById(targetViewId);
    if (targetEl) targetEl.classList.remove('hidden');
}

function goHome() {
    switchView('homeContainer');
    mainHeader.classList.remove('hidden');
    bottomNav.classList.remove('hidden');
}

function openSetup() {
    switchView('setupView');
    mainHeader.classList.add('hidden');
    bottomNav.classList.add('hidden');
    document.getElementById('childNameInput').value = appData.childName;
    resetPhotoUpload();
    renderSetupDictionary();
}

function openQuickType() {
    switchView('quickTypeView');
    mainHeader.classList.add('hidden');
    bottomNav.classList.add('hidden');
    const input = document.getElementById('quickTypeInput');
    input.value = '';
    setTimeout(() => input.focus(), 100);
}

function speakQuickType() {
    const input = document.getElementById('quickTypeInput');
    const text = input.value.trim();
    if (text) {
        speak(text);
    }
}

// Empties the type-to-speak box. Used to be an inline onclick that poked the DOM
// straight from the markup; now it's a named function wired up like everything else.
function clearQuickType() {
    document.getElementById('quickTypeInput').value = '';
}

function updateHomePreviews() {
    Object.keys(appData.categories).forEach(key => {
        const previewSpan = document.getElementById(`preview-${key}`);
        if (previewSpan) {
            const topItems = appData.categories[key].slice(0, 3).map(item => item.label).join(' • ');
            previewSpan.textContent = topItems || "Empty";
        }
    });
}

// --- Dynamic Category Rendering ---
function openCategory(categoryKey) {
    const presentation = category_presentation[categoryKey];
    if (!presentation) return; // unknown / tampered key: do nothing rather than throw

    speak(presentation.title);

    const header = document.getElementById('dynamicCategoryHeader');
    header.className = `flex items-center gap-3 px-8 py-5 rounded-full border-b-[4px] ${presentation.bg_class}`;

    const icon = document.getElementById('dynamicCategoryIcon');
    icon.textContent = presentation.icon;
    icon.className = `material-symbols-outlined text-4xl ${presentation.text_class}`;

    const title_element = document.getElementById('dynamicCategoryTitle');
    title_element.textContent = presentation.title;
    title_element.className = `text-2xl font-bold ${presentation.text_class}`;

    const grid = document.getElementById('dynamicCategoryGrid');
    grid.replaceChildren(); // clear the grid without touching innerHTML

    appData.categories[categoryKey].forEach(item => {
        const tile_button = document.createElement('button');
        tile_button.className = 'bg-white flex flex-col items-center justify-center min-h-[240px] p-6 rounded-[2.5rem] border-b-[8px] border-outline/10 active:scale-95 transition-transform shadow-sm';

        const speech_phrase = presentation.speech_prefix + item.label;
        tile_button.addEventListener('click', () => speak(speech_phrase));

        tile_button.appendChild(
            build_word_visual(item, 'w-32 h-32 mb-4 rounded-full object-cover border-4 border-surface-container shadow-sm', 'span', 'text-[6rem] mb-4')
        );

        const label_span = document.createElement('span');
        label_span.className = 'text-3xl font-bold text-on-surface';
        label_span.textContent = item.label;
        tile_button.appendChild(label_span);

        grid.appendChild(tile_button);
    });

    switchView('categoryView');
}

// --- Photo Processing ---
function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentTempPhoto = canvas.toDataURL('image/jpeg', 0.6);

            document.getElementById('photoPreviewIcon').classList.add('hidden');
            const previewImg = document.getElementById('photoPreviewImage');
            previewImg.src = currentTempPhoto;
            previewImg.classList.remove('hidden');
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

function resetPhotoUpload() {
    currentTempPhoto = null;
    document.getElementById('photoUpload').value = '';
    document.getElementById('photoPreviewIcon').classList.remove('hidden');
    document.getElementById('photoPreviewImage').classList.add('hidden');
    document.getElementById('photoPreviewImage').src = '';
}

// --- Setup Logic ---
function addWordToSetup() {
    const catKey = document.getElementById('newWordCategory').value;
    const labelInput = document.getElementById('newWordLabel');
    const emojiInput = document.getElementById('newWordEmoji');

    if (labelInput.value.trim() === '') return;

    appData.categories[catKey].push({
        id: Date.now(),
        label: labelInput.value.trim(),
        emoji: emojiInput.value.trim() || '❓',
        photoData: currentTempPhoto
    });

    labelInput.value = '';
    emojiInput.value = '';
    resetPhotoUpload();
    renderSetupDictionary();
}

function removeWord(categoryKey, id) {
    appData.categories[categoryKey] = appData.categories[categoryKey].filter(p => p.id !== id);
    renderSetupDictionary();
}

function renderSetupDictionary() {
    const list = document.getElementById('setupDictionaryList');
    list.replaceChildren();

    Object.keys(appData.categories).forEach(catKey => {
        const category_words = appData.categories[catKey];

        const category_heading = document.createElement('h3');
        category_heading.className = "text-xl font-bold text-on-surface mt-4 border-b-2 border-outline/10 pb-2";
        category_heading.textContent = (category_presentation[catKey] && category_presentation[catKey].title) || catKey;
        list.appendChild(category_heading);

        if (category_words.length === 0) {
            const empty_note = document.createElement('div');
            empty_note.className = "text-on-surface-variant italic mb-4";
            empty_note.textContent = "No words added to this category.";
            list.appendChild(empty_note);
            return;
        }

        const word_grid = document.createElement('div');
        word_grid.className = "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4";

        category_words.forEach(word => {
            const word_row = document.createElement('div');
            word_row.className = 'flex justify-between items-center bg-white p-3 rounded-xl border border-outline/10 shadow-sm';

            const info_wrap = document.createElement('div');
            info_wrap.className = 'flex items-center gap-4';
            info_wrap.appendChild(
                build_word_visual(word, 'w-16 h-16 rounded-full object-cover border-2 border-surface-container', 'div', 'w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-3xl')
            );
            const word_label = document.createElement('span');
            word_label.className = 'text-2xl font-bold';
            word_label.textContent = word.label;
            info_wrap.appendChild(word_label);
            word_row.appendChild(info_wrap);

            const delete_button = document.createElement('button');
            delete_button.className = 'text-error bg-error/10 w-12 h-12 rounded-full flex items-center justify-center hover:bg-error/20';
            const delete_icon = document.createElement('span');
            delete_icon.className = 'material-symbols-outlined';
            delete_icon.textContent = 'delete';
            delete_button.appendChild(delete_icon);
            // Real values captured in the closure - no inline onclick string, which
            // was the exact injection sink this refactor removes.
            delete_button.addEventListener('click', () => removeWord(catKey, word.id));
            word_row.appendChild(delete_button);

            word_grid.appendChild(word_row);
        });

        list.appendChild(word_grid);
    });
}

function saveAndStart() {
    appData.childName = document.getElementById('childNameInput').value.trim() || "Buddy";
    localStorage.setItem('chattyBuddyData_v4', JSON.stringify(appData));

    greetingText.textContent = `Hi ${appData.childName}!`;
    updateHomePreviews();
    goHome();
}

// --- Native Speech Synthesis ---
function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

/*
    Wire up every control WITHOUT any inline on* attributes, so the CSP can ban
    inline script entirely. Static buttons in the markup carry a data-action (and
    data-* params where a value is needed); one delegated listener dispatches them.
    Dynamically built buttons (word tiles, delete buttons) get their listeners the
    moment they're created, up in the render functions above.
*/
function wire_event_handlers() {
    const action_handlers = {
        openSetup: () => openSetup(),
        goHome: () => goHome(),
        openQuickType: () => openQuickType(),
        speakQuickType: () => speakQuickType(),
        clearQuickType: () => clearQuickType(),
        addWordToSetup: () => addWordToSetup(),
        saveAndStart: () => saveAndStart(),
        openCategory: (element) => openCategory(element.dataset.category),
        speak: (element) => speak(element.dataset.speak)
    };

    document.addEventListener('click', (event) => {
        const action_element = event.target.closest('[data-action]');
        if (!action_element) return;
        const handler = action_handlers[action_element.dataset.action];
        if (handler) handler(action_element);
    });

    // The hidden file input fires 'change', not 'click', so it gets its own listener.
    document.getElementById('photoUpload').addEventListener('change', handlePhotoSelect);
}

// Wire the controls, then boot. `defer` guarantees the DOM is ready by now, but we
// keep the DOMContentLoaded hook so nothing runs before the structure exists.
document.addEventListener('DOMContentLoaded', () => {
    wire_event_handlers();
    initApp();
});
