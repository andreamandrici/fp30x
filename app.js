/* ==========================================================================
   BLOCCO STATO GLOBALE E DICHIARAZIONE CONTROLLER CONTINUI (CC)
   ========================================================================== */
let midiOutput = null;
const MIDI_CHANNEL = 3; // Trasmissione di default su Canale 4 hardware (0xB3)

const CONTROLLERS = [
    { id: 'cc1',  num: 1,  default: 0 },
    { id: 'cc5',  num: 5,  default: 0 },
    { id: 'cc7',  num: 7,  default: 100 },  // Volume Canale / Mixer Universal
    { id: 'cc10', num: 10, default: 64 },
    { id: 'cc11', num: 11, default: 127 },
    { id: 'cc65', num: 65, default: 0 },    // Interruttore Portamento
    { id: 'cc71', num: 71, default: 64 },
    { id: 'cc72', num: 72, default: 64 },
    { id: 'cc73', num: 73, default: 64 },
    { id: 'cc74', num: 74, default: 64 },
    { id: 'cc75', num: 75, default: 64 },
    { id: 'cc76', num: 76, default: 64 },
    { id: 'cc77', num: 77, default: 64 },
    { id: 'cc78', num: 78, default: 64 },
    { id: 'cc84', num: 84, default: 0 },
    { id: 'cc91', num: 91, default: 40 },   // Mandata Riverbero / Ambience Universal
    { id: 'cc93', num: 93, default: 0 }    // Mandata Effetto Chorus Universal
];

/* ==========================================================================
   BLOCCO RIFERIMENTI AGLI ELEMENTI DEL DOM HTML
   ========================================================================== */
const statusDiv = document.getElementById('status');
const macroTypeSelect = document.getElementById('macroTypeSelect');
const groupSelect = document.getElementById('groupSelect');
const soundSelect = document.getElementById('soundSelect');
const btnChangeSound = document.getElementById('btnChangeSound');
const drumVisualizer = document.getElementById('drumVisualizer');
const drumKeySelect = document.getElementById('drumKeySelect');
const drumTableBody = document.querySelector('#drumTable tbody');
const midiMonitorLog = document.getElementById('midiMonitorLog');
const btnClearMonitor = document.getElementById('btnClearMonitor');

const btnResetAllSliders = document.getElementById('btnResetAllSliders');
const btnAllSoundOff = document.getElementById('btnAllSoundOff');
const btnResetControllers = document.getElementById('btnResetControllers');
const btnAllNotesOff = document.getElementById('btnAllNotesOff');

/* ==========================================================================
   BLOCCO TRADUZIONE CODICI NOTA IN LETTERE ALFABETICHE
   ========================================================================== */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteName(noteNumber) {
    const octave = Math.floor(noteNumber / 12) - 1;
    return `${NOTE_NAMES[noteNumber % 12]}${octave}`;
}

/* ==========================================================================
   BLOCCO MONITOR MIDI IN INGRESSO (DECODIFICA FLUSSO HARDWARE DAL PIANOFORTE)
   ========================================================================== */
function handleMidiInput(event) {
    const data = event.data;
    if (!data || data.length === 0) return;

    const command = data[0] & 0xF0;
    const channel = (data[0] & 0x0F) + 1; // Base 1
    
    let logText = ""; 
    let cssClass = "system-msg";
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    switch (command) {
        case 0x90: // Note On
            const noteOnName = getNoteName(data[1]);
            const velocityOn = data[2];
            if (velocityOn > 0) {
                logText = `[${timestamp}] IN (Ch.${channel}) | Note On : ${noteOnName} (KeyN: ${data[1]}), Vel: ${velocityOn}`;
                cssClass = "note-on";
            } else {
                logText = `[${timestamp}] IN (Ch.${channel}) | Note Off: ${noteOnName} (KeyN: ${data[1]})`;
                cssClass = "note-off";
            }
            break;
        case 0x80: // Note Off
            const noteOffName = getNoteName(data[1]);
            logText = `[${timestamp}] IN (Ch.${channel}) | Note Off: ${noteOffName} (KeyN: ${data[1]})`;
            cssClass = "note-off";
            break;
        case 0xB0: // Control Change da hardware
            logText = `[${timestamp}] IN (Ch.${channel}) | CC Recv : Controller ${data[1]}, Valore: ${data[2]}`;
            cssClass = "cc-msg";
            break;
        case 0xC0: // Program Change da hardware
            logText = `[${timestamp}] IN (Ch.${channel}) | Prog Recv: Strumento ID ${data[1] + 1} (PC: ${data[1]})`;
            cssClass = "pb-msg";
            break;
        case 0xE0: // Pitch Bend
            const bend = data[1] | (data[2] << 7);
            logText = `[${timestamp}] IN (Ch.${channel}) | PitchBend: Valore ${bend}`;
            cssClass = "pb-msg";
            break;
        default: 
            return;
    }

    if (midiMonitorLog && midiMonitorLog.querySelector('.system-msg') && midiMonitorLog.children.length === 1) {
        midiMonitorLog.innerHTML = "";
    }
    if (midiMonitorLog) {
        const row = document.createElement('div'); 
        row.className = `monitor-row ${cssClass}`;
        row.innerText = logText; 
        midiMonitorLog.appendChild(row); 
        midiMonitorLog.scrollTop = midiMonitorLog.scrollHeight;
    }
}

/* ==========================================================================
   BLOCCO SELEZIONE MACRO TIPO NEI MENU A CASCATA REATTIVI TIMBRI
   ========================================================================== */
if (macroTypeSelect) {
    macroTypeSelect.addEventListener('change', () => {
        const selectedType = macroTypeSelect.value;
        groupSelect.innerHTML = '<option value="">Seleziona Gruppo...</option>';
        soundSelect.innerHTML = '<option value="">Seleziona lo strumento specifico...</option>';
        soundSelect.disabled = true;
        if (!selectedType) { groupSelect.disabled = true; return; }
        
        if (typeof ROLAND_SOUNDS !== 'undefined') {
            const filteredGroups = [...new Set(ROLAND_SOUNDS.filter(s => s.type === selectedType).map(s => s.group))];
            filteredGroups.forEach(g => {
                let opt = document.createElement('option'); opt.value = g; opt.innerHTML = g; groupSelect.appendChild(opt);
            });
            groupSelect.disabled = false;
        }
    });
}

if (groupSelect) {
    groupSelect.addEventListener('change', () => {
        const selectedType = macroTypeSelect.value; 
        const selectedGroup = groupSelect.value;
        soundSelect.innerHTML = '<option value="">Seleziona lo strumento specifico...</option>';
        if (!selectedGroup) { soundSelect.disabled = true; return; }
        
        if (typeof ROLAND_SOUNDS !== 'undefined') {
            const filteredSounds = ROLAND_SOUNDS.filter(s => s.type === selectedType && s.group === selectedGroup);
            filteredSounds.forEach(s => {
                let opt = document.createElement('option'); 
                opt.value = ROLAND_SOUNDS.indexOf(s); 
                opt.innerHTML = s.name; 
                soundSelect.appendChild(opt);
            });
            soundSelect.disabled = false;
        }
    });
}

if (soundSelect) {
    soundSelect.addEventListener('change', () => {
        if (typeof ROLAND_SOUNDS === 'undefined') return;
        const s = ROLAND_SOUNDS[parseInt(soundSelect.value)];
        if (s && s.isDrum) { 
            if (drumVisualizer) drumVisualizer.classList.remove('hidden'); 
            updateDrumTable(parseInt(drumKeySelect ? drumKeySelect.value || 0 : 0)); 
        } else { 
            if (drumVisualizer) drumVisualizer.classList.add('hidden'); 
        }
    });
}

/* ==========================================================================
   BLOCCO GESTIONE LOG DI OUTPUT (AZIONI EFFETTUATE DALLA PAGINA WEB)
   ========================================================================== */
function appendOutputLog(text, cssClass) {
    if (!midiMonitorLog) return;
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    if (midiMonitorLog.querySelector('.system-msg') && midiMonitorLog.children.length === 1) {
        midiMonitorLog.innerHTML = "";
    }
    const row = document.createElement('div'); 
    row.className = `monitor-row ${cssClass}`;
    row.innerText = `[${timestamp}] OUT | ${text}`;
    midiMonitorLog.appendChild(row); 
    midiMonitorLog.scrollTop = midiMonitorLog.scrollHeight;
}

/* ==========================================================================
   BLOCCO LOGICA TRASMISSIONE EVENTI MIDI CC E RESET AL VALORE DI DEFAULT
   ========================================================================== */
function sendCC(ccNum, value) {
    if (!midiOutput) return;

    // Gli slider universali (CC 7 Volume, CC 91 Reverb/Ambience, CC 93 Chorus)
    // vengono trasmessi a TUTTI i 16 canali MIDI (0xB0..0xBF)
    if (ccNum === 7 || ccNum === 91 || ccNum === 93) {
        for (let ch = 0; ch < 16; ch++) {
            midiOutput.send([0xB0 | ch, ccNum, value]);
        }
        appendOutputLog(`CC Universal Sent : Controller ${ccNum}, Valore: ${value} (Canali 1-16)`, "cc-msg");
    } else {
        // I controlli specifici del timbro/inviluppo vengono inviati sul Canale 4 (MIDI_CHANNEL = 3)
        midiOutput.send([0xB0 | MIDI_CHANNEL, ccNum, value]);
        appendOutputLog(`CC Sent (Ch.4)  : Controller ${ccNum}, Valore: ${value}`, "cc-msg");
    }
}

function resetToDefault(cc) {
    const input = document.getElementById(cc.id); 
    const labelVal = document.getElementById(`${cc.id}_val`);
    if (input) {
        if (input.type === "checkbox") { 
            input.checked = cc.default === 127; 
            if (labelVal) labelVal.innerText = input.checked ? "ON" : "OFF"; 
            sendCC(cc.num, cc.default); 
        } else { 
            input.value = cc.default; 
            if (labelVal) labelVal.innerText = cc.default; 
            sendCC(cc.num, cc.default); 
        }
    }
}

/* ==========================================================================
   BLOCCO ASCOLTATORI E ATTIVAZIONE AUTOMATICA DEGLI SLIDER (RANGE E CHECKBOX)
   ========================================================================== */
function setupControllerListeners() {
    CONTROLLERS.forEach(cc => {
        const input = document.getElementById(cc.id); 
        const labelVal = document.getElementById(`${cc.id}_val`);
        const container = document.getElementById(`container_${cc.id}`);
        
        if (input) {
            if (input.type === "checkbox") {
                input.addEventListener('change', (e) => { 
                    const val = e.target.checked ? 127 : 0; 
                    if (labelVal) labelVal.innerText = e.target.checked ? "ON" : "OFF"; 
                    sendCC(cc.num, val); 
                });
                input.addEventListener('dblclick', () => { 
                    resetToDefault(cc);
                });
            } else {
                input.addEventListener('input', (e) => { 
                    const val = parseInt(e.target.value); 
                    if (labelVal) labelVal.innerText = val; 
                    sendCC(cc.num, val); 
                });
                input.addEventListener('dblclick', () => resetToDefault(cc));
            }
        }
        if (container) {
            const label = container.querySelector('.reset-trigger');
            if (label) { 
                label.addEventListener('dblclick', () => { 
                    resetToDefault(cc); 
                }); 
            }
        }
    });
}

/* ==========================================================================
   BLOCCO PULSANTI AUSILIARI & RESET GLOBALE AI VALORI DEFAULT FP-30X
   ========================================================================== */
if (btnResetAllSliders) {
    btnResetAllSliders.addEventListener('click', () => {
        CONTROLLERS.forEach(cc => resetToDefault(cc));
        appendOutputLog("Reset eseguito: tutti gli slider ripristinati ai valori default Roland FP-30X", "system-msg");
    });
}
if (btnAllSoundOff) {
    btnAllSoundOff.addEventListener('click', () => sendCC(120, 0));
}
if (btnResetControllers) {
    btnResetControllers.addEventListener('click', () => sendCC(121, 0));
}
if (btnAllNotesOff) {
    btnAllNotesOff.addEventListener('click', () => sendCC(123, 0));
}
if (btnClearMonitor) {
    btnClearMonitor.addEventListener('click', () => {
        if (midiMonitorLog) {
            midiMonitorLog.innerHTML = '<div class="monitor-row system-msg">Log svuotato. In attesa di messaggi...</div>';
        }
    });
}

/* ==========================================================================
   BLOCCO APERTURA PORTE CONNESIONE WEB MIDI API (STANDARD)
   ========================================================================== */
if (navigator.requestMIDIAccess) { 
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure); 
} else if (statusDiv) { 
    statusDiv.innerHTML = "Errore: Browser non supportato. Usa Chrome o Edge."; 
    statusDiv.style.background = "#d32f2f"; 
}

function onMIDISuccess(midiAccess) {
    const outputs = Array.from(midiAccess.outputs.values());
    midiOutput = outputs.find(o => o.name.toLowerCase().includes('fp-30x') || o.name.toLowerCase().includes('roland')) || outputs[0] || null;

    const inputs = Array.from(midiAccess.inputs.values());
    for (let input of inputs) { 
        if (input.name.toLowerCase().includes('fp-30x') || input.name.toLowerCase().includes('roland') || inputs.length === 1) { 
            input.onmidimessage = handleMidiInput; 
            break; 
        } 
    }

    if (midiOutput && statusDiv) { 
        statusDiv.innerHTML = `Connesso Hardware (In/Out Attivo): ${midiOutput.name}`; 
        statusDiv.style.background = "#2e7d32"; 
        enableControls(); 
    } else if (statusDiv) { 
        statusDiv.innerHTML = "Roland FP-30X scollegato. Connettilo via USB."; 
        statusDiv.style.background = "#e65100"; 
    }
}

function onMIDIFailure() { 
    if (statusDiv) {
        statusDiv.innerHTML = "Accesso MIDI Hardware fallito."; 
        statusDiv.style.background = "#d32f2f"; 
    }
}

/* ==========================================================================
   BLOCCO ABILITAZIONE GENERALE INTERFACCIA GRAFICA
   ========================================================================== */
function enableControls() {
    if (macroTypeSelect) macroTypeSelect.disabled = false; 
    if (btnChangeSound) btnChangeSound.disabled = false; 
    if (drumKeySelect) drumKeySelect.disabled = false;
    
    CONTROLLERS.forEach(cc => { 
        const el = document.getElementById(cc.id); 
        if (el) el.disabled = false; 
    });
    
    if (btnResetAllSliders) btnResetAllSliders.disabled = false;
    if (btnAllSoundOff) btnAllSoundOff.disabled = false; 
    if (btnResetControllers) btnResetControllers.disabled = false; 
    if (btnAllNotesOff) btnAllNotesOff.disabled = false;
    
    initDrumVisualizer(); 
    setupControllerListeners();
}

/* ==========================================================================
   BLOCCO INVIO PROGRAM CHANGE FINALE (TRASMISSIONE SU CANALE 4)
   ========================================================================== */
if (btnChangeSound) {
    btnChangeSound.addEventListener('click', () => {
        if (!midiOutput || !soundSelect || !soundSelect.value || soundSelect.value === "") return; 
        if (typeof ROLAND_SOUNDS === 'undefined') return;
        
        const index = parseInt(soundSelect.value);
        if (isNaN(index) || !ROLAND_SOUNDS[index]) return;

        const s = ROLAND_SOUNDS[index];
        
        midiOutput.send([0xB0 | MIDI_CHANNEL, 0, s.cc00]); 
        midiOutput.send([0xB0 | MIDI_CHANNEL, 32, s.cc32]); 
        midiOutput.send([0xC0 | MIDI_CHANNEL, s.pc]);
        
        appendOutputLog(`Prog Sent (Ch.4): ${s.name} [MSB:${s.cc00} LSB:${s.cc32} PC:${s.pc + 1}]`, "pb-msg");
    });
}

/* ==========================================================================
   BLOCCO LOGICA INIZIALIZZAZIONE E COSTRUZIONE TABELLA VISIVA DRUM KIT
   ========================================================================== */
function initDrumVisualizer() {
    if (!drumKeySelect) return;
    drumKeySelect.innerHTML = "";
    if (typeof DRUM_KEY_MAP !== 'undefined') {
        DRUM_KEY_MAP.forEach((item, index) => {
            let opt = document.createElement('option'); opt.value = index;
            opt.innerHTML = `Tasto ${item.key} (KeyN: ${item.name})`; drumKeySelect.appendChild(opt);
        });
        updateDrumTable(0);
    }
}

if (drumKeySelect) {
    drumKeySelect.addEventListener('change', () => {
        updateDrumTable(parseInt(drumKeySelect.value || 0));
    });
}

function updateDrumTable(index) {
    if (typeof DRUM_KEY_MAP === 'undefined' || !drumTableBody) return;
    const d = DRUM_KEY_MAP[index]; if (!d) return;
    drumTableBody.innerHTML = `
        <tr><td><strong>Standard Set</strong></td><td>${d.standard}</td></tr>
        <tr><td><strong>Room Set</strong></td><td>${d.room}</td></tr>
        <tr><td><strong>Power Set</strong></td><td>${d.power}</td></tr>
        <tr><td><strong>Electric Set</strong></td><td>${d.electric}</td></tr>
        <tr><td><strong>Analog Set</strong></td><td>${d.analog}</td></tr>
        <tr><td><strong>Jazz Set</strong></td><td>${d.jazz}</td></tr>
        <tr><td><strong>Brush Set</strong></td><td>${d.brush}</td></tr>
        <tr><td><strong>Orchestra Set</strong></td><td>${d.orchestra}</td></tr>
        <tr><td><strong>SFX Set</strong></td><td>${d.sfx}</td></tr>
    `;
}
