/* ==========================================================================
   ROLAND FP-30X WEB CONTROLLER - APP.JS (FULL ENGLISH VERSION WITH METRONOME & SONGS)
   ========================================================================== */

/* ==========================================================================
   GLOBAL STATE & CONTINUOUS CONTROLLER (CC) DECLARATIONS
   ========================================================================== */
let midiOutput = null;
const MIDI_CHANNEL = 3; // Hardware Channel 4 (0xB3 for CC)

const CONTROLLERS = [
    { id: 'cc1',  num: 1,  default: 0 },
    { id: 'cc5',  num: 5,  default: 0 },
    { id: 'cc7',  num: 7,  default: 100 },
    { id: 'cc10', num: 10, default: 64 },
    { id: 'cc11', num: 11, default: 127 },
    { id: 'cc65', num: 65, default: 0 },   // Portamento Switch (OFF = 0, ON = 127)
    { id: 'cc71', num: 71, default: 64 },
    { id: 'cc72', num: 72, default: 64 },
    { id: 'cc73', num: 73, default: 64 },
    { id: 'cc74', num: 74, default: 64 },
    { id: 'cc75', num: 75, default: 64 },
    { id: 'cc76', num: 76, default: 64 },
    { id: 'cc77', num: 77, default: 64 },
    { id: 'cc78', num: 78, default: 64 },
    { id: 'cc84', num: 84, default: 0 },
    { id: 'cc91', num: 91, default: 40 },  // Reverb Send / Ambience
    { id: 'cc93', num: 93, default: 0 }   // Chorus Send
];

/* ==========================================================================
   DOM ELEMENT REFERENCES
   ========================================================================== */
const statusDiv = document.getElementById('status');
const macroTypeSelect = document.getElementById('macroTypeSelect');
const groupSelect = document.getElementById('groupSelect');
const soundSelect = document.getElementById('soundSelect');
const btnChangeSound = document.getElementById('btnChangeSound');
const reverbTypeSelect = document.getElementById('reverbTypeSelect');

const drumVisualizer = document.getElementById('drumVisualizer');
const drumKeySelect = document.getElementById('drumKeySelect');
const drumTableBody = document.querySelector('#drumTable tbody');
const midiMonitorLog = document.getElementById('midiMonitorLog');
const btnClearMonitor = document.getElementById('btnClearMonitor');

const btnResetAllSliders = document.getElementById('btnResetAllSliders');
const btnAllSoundOff = document.getElementById('btnAllSoundOff');
const btnResetControllers = document.getElementById('btnResetControllers');
const btnAllNotesOff = document.getElementById('btnAllNotesOff');

const presetNameInput = document.getElementById('presetNameInput');
const btnSavePreset = document.getElementById('btnSavePreset');
const presetSelect = document.getElementById('presetSelect');
const btnLoadPreset = document.getElementById('btnLoadPreset');
const btnDeletePreset = document.getElementById('btnDeletePreset');

// METRONOME CONTROLS
const metroToggleBtn = document.getElementById('metroToggleBtn');
const metroBpmInput = document.getElementById('metroBpmInput');
const metroBpmVal = document.getElementById('metroBpmVal');
const metroVolInput = document.getElementById('metroVolInput');
const metroVolVal = document.getElementById('metroVolVal');
const metroBeatSelect = document.getElementById('metroBeatSelect');
const metroToneSelect = document.getElementById('metroToneSelect');
const metroPatternSelect = document.getElementById('metroPatternSelect');

// SONG PLAYER CONTROLS
const songPlayBtn = document.getElementById('songPlayBtn');
const songStopBtn = document.getElementById('songStopBtn');
const songVolInput = document.getElementById('songVolInput');
const songVolVal = document.getElementById('songVolVal');
const countInSelect = document.getElementById('countInSelect');

const usbPrevBtn = document.getElementById('usbPrevBtn');
const usbPlayBtn = document.getElementById('usbPlayBtn');
const usbNextBtn = document.getElementById('usbNextBtn');

let isMetronomeRunning = false;
let isSongPlaying = false;

/* ==========================================================================
   NOTE NUMBER TO LETTER CONVERSION
   ========================================================================== */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteName(noteNumber) {
    const octave = Math.floor(noteNumber / 12) - 1;
    return `${NOTE_NAMES[noteNumber % 12]}${octave}`;
}

/* ==========================================================================
   INCOMING MIDI MONITOR (INPUT DECODING)
   ========================================================================== */
function handleMidiInput(event) {
    const data = event.data;
    if (!data || data.length < 1) return;

    const command = data[0] & 0xF0;
    const channel = (data[0] & 0x0F) + 1; // Base 1
    
    let logText = ""; 
    let cssClass = "system-msg";
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    switch (command) {
        case 0x90: // Note On
            if (data.length < 3) return;
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
            if (data.length < 2) return;
            const noteOffName = getNoteName(data[1]);
            logText = `[${timestamp}] IN (Ch.${channel}) | Note Off: ${noteOffName} (KeyN: ${data[1]})`;
            cssClass = "note-off";
            break;
        case 0xB0: // Control Change from hardware
            if (data.length < 3) return;
            logText = `[${timestamp}] IN (Ch.${channel}) | CC Recv : Controller ${data[1]}, Value: ${data[2]}`;
            cssClass = "cc-msg";
            break;
        case 0xC0: // Program Change from hardware
            if (data.length < 2) return;
            logText = `[${timestamp}] IN (Ch.${channel}) | Prog Recv: Instrument ID ${data[1] + 1} (PC: ${data[1]})`;
            cssClass = "pb-msg";
            break;
        case 0xE0: // Pitch Bend
            if (data.length < 3) return;
            const bend = data[1] | (data[2] << 7);
            logText = `[${timestamp}] IN (Ch.${channel}) | PitchBend: Value ${bend}`;
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
   MACRO TYPE & GROUP SELECTION DROPDOWNS
   ========================================================================== */
if (macroTypeSelect) {
    macroTypeSelect.addEventListener('change', () => {
        const selectedType = macroTypeSelect.value;
        groupSelect.innerHTML = '<option value="">Select Group...</option>';
        soundSelect.innerHTML = '<option value="">Select specific instrument...</option>';
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
        soundSelect.innerHTML = '<option value="">Select specific instrument...</option>';
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
   REVERB TYPE SELECTION (SYSEX GM2/GLOBAL)
   ========================================================================== */
if (reverbTypeSelect) {
    reverbTypeSelect.addEventListener('change', () => {
        if (!midiOutput) return;
        const typeVal = parseInt(reverbTypeSelect.value);
        // Universal Realtime SysEx Global Parameter Control - Reverb Type: F0 7F 7F 04 05 01 01 01 01 01 00 vv F7
        const sysexMsg = [0xF0, 0x7F, 0x7F, 0x04, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, typeVal, 0xF7];
        try {
            midiOutput.send(sysexMsg);
            appendOutputLog(`SysEx Sent: Reverb Type = ${reverbTypeSelect.options[reverbTypeSelect.selectedIndex].text}`, "cc-msg");
        } catch(e) {
            appendOutputLog(`SysEx Reverb Type blocked by browser (Requires HTTPS/SysEx permission)`, "system-msg");
        }
    });
}

/* ==========================================================================
   OUTPUT LOG MANAGEMENT
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
   MIDI CC TRANSMISSION LOGIC & RESET TO DEFAULT
   ========================================================================== */
function sendCC(ccNum, value) {
    if (!midiOutput) return;
    
    // Universal controls (Volume CC7, Reverb CC91, Chorus CC93) send to ALL channels 1..16
    if (ccNum === 7 || ccNum === 91 || ccNum === 93) {
        for (let ch = 0; ch < 16; ch++) {
            midiOutput.send([0xB0 | ch, ccNum, value]);
        }
        
        if (ccNum === 91) {
            try {
                // Universal Realtime SysEx - Reverb Level: F0 7F 7F 04 05 01 01 01 01 01 01 vv F7
                midiOutput.send([0xF0, 0x7F, 0x7F, 0x04, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, value, 0xF7]);
            } catch(e) {}
        }
    } else {
        // Standard send on Channel 4 (MIDI_CHANNEL = 3) and Channel 1 for local keyboard response
        midiOutput.send([0xB0 | MIDI_CHANNEL, ccNum, value]);
        midiOutput.send([0xB0 | 0, ccNum, value]);
    }

    appendOutputLog(`CC Sent  : Controller ${ccNum}, Value: ${value}`, "cc-msg");
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
   SLIDER & CONTROL LISTENERS (RANGE AND CHECKBOX)
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
   FULL METRONOME CONTROLS IMPLEMENTATION
   ========================================================================== */
if (metroToggleBtn) {
    metroToggleBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        isMetronomeRunning = !isMetronomeRunning;
        metroToggleBtn.innerText = isMetronomeRunning ? "⏹️ Stop Metronome" : "⏱️ Start Metronome";
        metroToggleBtn.className = isMetronomeRunning ? "btn-danger" : "btn-warn";
        
        try {
            const val = isMetronomeRunning ? 0x01 : 0x00;
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x01, val, 0xF7]);
        } catch(e) {}
        
        appendOutputLog(`Metronome State: ${isMetronomeRunning ? "STARTED" : "STOPPED"}`, "system-msg");
    });
}

if (metroBpmInput) {
    metroBpmInput.addEventListener('input', () => {
        const bpm = parseInt(metroBpmInput.value);
        if (metroBpmVal) metroBpmVal.innerText = bpm;
        if (!midiOutput) return;
        
        try {
            const msb = (bpm >> 8) & 0x0F;
            const lsb = bpm & 0xFF;
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x02, msb, lsb, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Metronome Tempo: ${bpm} BPM`, "cc-msg");
    });
}

if (metroVolInput) {
    metroVolInput.addEventListener('input', () => {
        const vol = parseInt(metroVolInput.value);
        if (metroVolVal) metroVolVal.innerText = vol;
        if (!midiOutput) return;
        
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x03, vol, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Metronome Volume: ${vol}/10`, "cc-msg");
    });
}

if (metroBeatSelect) {
    metroBeatSelect.addEventListener('change', () => {
        const beat = parseInt(metroBeatSelect.value);
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x04, beat, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Metronome Beat/Time Signature: ${metroBeatSelect.options[metroBeatSelect.selectedIndex].text}`, "cc-msg");
    });
}

if (metroToneSelect) {
    metroToneSelect.addEventListener('change', () => {
        const tone = parseInt(metroToneSelect.value);
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x05, tone, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Metronome Click Tone: ${metroToneSelect.options[metroToneSelect.selectedIndex].text}`, "cc-msg");
    });
}

if (metroPatternSelect) {
    metroPatternSelect.addEventListener('change', () => {
        const pat = parseInt(metroPatternSelect.value);
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x00, 0x06, pat, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Metronome Subdivision Pattern: ${metroPatternSelect.options[metroPatternSelect.selectedIndex].text}`, "cc-msg");
    });
}

/* ==========================================================================
   SONG PLAYER & USB MEDIA NAVIGATION IMPLEMENTATION
   ========================================================================== */
if (songPlayBtn) {
    songPlayBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        isSongPlaying = !isSongPlaying;
        songPlayBtn.innerText = isSongPlaying ? "⏸️ Pause Song" : "▶️ Play Song";
        if (isSongPlaying) {
            midiOutput.send([0xFA]); // MIDI Realtime Start
        } else {
            midiOutput.send([0xFC]); // MIDI Realtime Stop
        }
        appendOutputLog(`Song Transport: ${isSongPlaying ? "PLAYING" : "PAUSED"}`, "system-msg");
    });
}

if (songStopBtn) {
    songStopBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        isSongPlaying = false;
        if (songPlayBtn) songPlayBtn.innerText = "▶️ Play Song";
        midiOutput.send([0xFC]); // MIDI Realtime Stop
        midiOutput.send([0xF2, 0x00, 0x00]); // Song Position Pointer Reset
        appendOutputLog(`Song Transport: STOPPED & REWOUND TO START`, "system-msg");
    });
}

if (songVolInput) {
    songVolInput.addEventListener('input', () => {
        const vol = parseInt(songVolInput.value);
        if (songVolVal) songVolVal.innerText = vol;
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x01, 0x00, vol, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Song Playback Volume: ${vol}/10`, "cc-msg");
    });
}

if (countInSelect) {
    countInSelect.addEventListener('change', () => {
        const cnt = parseInt(countInSelect.value);
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x01, 0x01, cnt, 0xF7]);
        } catch(e) {}
        appendOutputLog(`Count-In Setup: ${countInSelect.options[countInSelect.selectedIndex].text}`, "cc-msg");
    });
}

if (usbPrevBtn) {
    usbPrevBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x02, 0x01, 0x00, 0xF7]);
        } catch(e) {}
        appendOutputLog(`USB Media Navigation: PREVIOUS TRACK`, "pb-msg");
    });
}

if (usbPlayBtn) {
    usbPlayBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x02, 0x00, 0x01, 0xF7]);
        } catch(e) {}
        appendOutputLog(`USB Media Navigation: PLAY / PAUSE USB SONG`, "pb-msg");
    });
}

if (usbNextBtn) {
    usbNextBtn.addEventListener('click', () => {
        if (!midiOutput) return;
        try {
            midiOutput.send([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x3B, 0x12, 0x00, 0x00, 0x02, 0x02, 0x00, 0xF7]);
        } catch(e) {}
        appendOutputLog(`USB Media Navigation: NEXT TRACK`, "pb-msg");
    });
}

/* ==========================================================================
   AUXILIARY BUTTONS & TOTAL SLIDER RESET
   ========================================================================== */
if (btnResetAllSliders) {
    btnResetAllSliders.addEventListener('click', () => {
        CONTROLLERS.forEach(cc => {
            resetToDefault(cc);
        });
        appendOutputLog("All sliders reset to FP-30X default values", "system-msg");
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
            midiMonitorLog.innerHTML = '<div class="monitor-row system-msg">Log cleared. Waiting for messages...</div>';
        }
    });
}

/* ==========================================================================
   NAMED PRESET MANAGEMENT (LOCALSTORAGE)
   ========================================================================== */
function getSavedPresets() {
    try {
        return JSON.parse(localStorage.getItem('fp30x_presets_en') || '{}');
    } catch(e) {
        return {};
    }
}

function updatePresetDropdown() {
    if (!presetSelect) return;
    const presets = getSavedPresets();
    presetSelect.innerHTML = '<option value="">Select a saved preset...</option>';
    Object.keys(presets).forEach(name => {
        let opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        presetSelect.appendChild(opt);
    });
}

if (btnSavePreset) {
    btnSavePreset.addEventListener('click', () => {
        const name = presetNameInput ? presetNameInput.value.trim() : "";
        if (!name) {
            alert("Please enter a name for the preset!");
            return;
        }
        const state = {
            macroType: macroTypeSelect ? macroTypeSelect.value : "",
            group: groupSelect ? groupSelect.value : "",
            soundIndex: soundSelect ? soundSelect.value : "",
            reverbType: reverbTypeSelect ? reverbTypeSelect.value : "1",
            controllers: {}
        };
        CONTROLLERS.forEach(cc => {
            const el = document.getElementById(cc.id);
            if (el) {
                state.controllers[cc.id] = el.type === "checkbox" ? (el.checked ? 127 : 0) : parseInt(el.value);
            }
        });
        const presets = getSavedPresets();
        presets[name] = state;
        localStorage.setItem('fp30x_presets_en', JSON.stringify(presets));
        if (presetNameInput) presetNameInput.value = "";
        updatePresetDropdown();
        appendOutputLog(`Preset saved: "${name}"`, "system-msg");
    });
}

if (btnLoadPreset) {
    btnLoadPreset.addEventListener('click', () => {
        const name = presetSelect ? presetSelect.value : "";
        if (!name) return;
        const presets = getSavedPresets();
        const state = presets[name];
        if (!state) return;

        // Restore Tone Selection
        if (state.macroType && macroTypeSelect) {
            macroTypeSelect.value = state.macroType;
            macroTypeSelect.dispatchEvent(new Event('change'));
            if (state.group && groupSelect) {
                groupSelect.value = state.group;
                groupSelect.dispatchEvent(new Event('change'));
                if (state.soundIndex !== "" && soundSelect) {
                    soundSelect.value = state.soundIndex;
                    soundSelect.dispatchEvent(new Event('change'));
                    if (btnChangeSound) btnChangeSound.click();
                }
            }
        }

        // Restore Reverb Type
        if (state.reverbType && reverbTypeSelect) {
            reverbTypeSelect.value = state.reverbType;
            reverbTypeSelect.dispatchEvent(new Event('change'));
        }

        // Restore Controllers
        if (state.controllers) {
            CONTROLLERS.forEach(cc => {
                if (state.controllers[cc.id] !== undefined) {
                    const val = state.controllers[cc.id];
                    const input = document.getElementById(cc.id);
                    const labelVal = document.getElementById(`${cc.id}_val`);
                    if (input) {
                        if (input.type === "checkbox") {
                            input.checked = val === 127;
                            if (labelVal) labelVal.innerText = input.checked ? "ON" : "OFF";
                        } else {
                            input.value = val;
                            if (labelVal) labelVal.innerText = val;
                        }
                        sendCC(cc.num, val);
                    }
                }
            });
        }
        appendOutputLog(`Preset loaded: "${name}"`, "system-msg");
    });
}

if (btnDeletePreset) {
    btnDeletePreset.addEventListener('click', () => {
        const name = presetSelect ? presetSelect.value : "";
        if (!name) return;
        const presets = getSavedPresets();
        delete presets[name];
        localStorage.setItem('fp30x_presets_en', JSON.stringify(presets));
        updatePresetDropdown();
        appendOutputLog(`Preset deleted: "${name}"`, "system-msg");
    });
}

updatePresetDropdown();

/* ==========================================================================
   WEB MIDI API CONNECTION (WITH SYSEX REQUEST AND FALLBACK)
   ========================================================================== */
if (navigator.requestMIDIAccess) { 
    navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess).catch(() => {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    });
} else if (statusDiv) { 
    statusDiv.innerHTML = "Error: Unsupported browser. Use Chrome or Edge on HTTPS/Localhost."; 
    statusDiv.style.background = "#d32f2f"; 
}

function onMIDISuccess(midiAccess) {
    const outputs = Array.from(midiAccess.outputs.values());
    midiOutput = outputs.find(o => o.name.toLowerCase().includes('fp-30x') || o.name.toLowerCase().includes('roland')) || outputs[0] || null;

    const inputs = Array.from(midiAccess.inputs.values());
    inputs.forEach(input => {
        if (input.name.toLowerCase().includes('fp-30x') || input.name.toLowerCase().includes('roland') || inputs.length === 1) {
            input.onmidimessage = handleMidiInput;
        }
    });

    if (midiOutput && statusDiv) { 
        statusDiv.innerHTML = `Connected Hardware (Active In/Out): ${midiOutput.name}`; 
        statusDiv.style.background = "#2e7d32"; 
        enableControls(); 
    } else if (statusDiv) { 
        statusDiv.innerHTML = "Roland FP-30X disconnected. Connect via USB."; 
        statusDiv.style.background = "#e65100"; 
    }
}

function onMIDIFailure() { 
    if (statusDiv) {
        statusDiv.innerHTML = "MIDI Hardware access failed or denied by browser."; 
        statusDiv.style.background = "#d32f2f"; 
    }
}

/* ==========================================================================
   GENERAL GRAPHICAL INTERFACE ENABLEMENT
   ========================================================================== */
function enableControls() {
    if (macroTypeSelect) macroTypeSelect.disabled = false; 
    if (btnChangeSound) btnChangeSound.disabled = false; 
    if (reverbTypeSelect) reverbTypeSelect.disabled = false;
    if (drumKeySelect) drumKeySelect.disabled = false;
    
    CONTROLLERS.forEach(cc => { 
        const el = document.getElementById(cc.id); 
        if (el) el.disabled = false; 
    });
    
    if (btnResetAllSliders) btnResetAllSliders.disabled = false;
    if (btnAllSoundOff) btnAllSoundOff.disabled = false; 
    if (btnResetControllers) btnResetControllers.disabled = false; 
    if (btnAllNotesOff) btnAllNotesOff.disabled = false;

    // Enable Metronome Controls
    if (metroToggleBtn) metroToggleBtn.disabled = false;
    if (metroBpmInput) metroBpmInput.disabled = false;
    if (metroVolInput) metroVolInput.disabled = false;
    if (metroBeatSelect) metroBeatSelect.disabled = false;
    if (metroToneSelect) metroToneSelect.disabled = false;
    if (metroPatternSelect) metroPatternSelect.disabled = false;

    // Enable Song Controls
    if (songPlayBtn) songPlayBtn.disabled = false;
    if (songStopBtn) songStopBtn.disabled = false;
    if (songVolInput) songVolInput.disabled = false;
    if (countInSelect) countInSelect.disabled = false;

    if (usbPrevBtn) usbPrevBtn.disabled = false;
    if (usbPlayBtn) usbPlayBtn.disabled = false;
    if (usbNextBtn) usbNextBtn.disabled = false;
    
    initDrumVisualizer(); 
    setupControllerListeners();
}

/* ==========================================================================
   PROGRAM CHANGE TRANSMISSION
   ========================================================================== */
if (btnChangeSound) {
    btnChangeSound.addEventListener('click', () => {
        if (!midiOutput || !soundSelect || !soundSelect.value || soundSelect.value === "") return; 
        if (typeof ROLAND_SOUNDS === 'undefined') return;
        
        const index = parseInt(soundSelect.value);
        if (isNaN(index) || !ROLAND_SOUNDS[index]) return;

        const s = ROLAND_SOUNDS[index];
        
        // Send Bank Select (CC00 / CC32) & Program Change (PC) to both Channel 4 and Channel 1
        midiOutput.send([0xB0 | MIDI_CHANNEL, 0, s.cc00]); 
        midiOutput.send([0xB0 | MIDI_CHANNEL, 32, s.cc32]); 
        midiOutput.send([0xC0 | MIDI_CHANNEL, s.pc]);

        midiOutput.send([0xB0 | 0, 0, s.cc00]); 
        midiOutput.send([0xB0 | 0, 32, s.cc32]); 
        midiOutput.send([0xC0 | 0, s.pc]);
        
        appendOutputLog(`Prog Sent: ${s.name} [MSB:${s.cc00} LSB:${s.cc32} PC:${s.pc + 1}]`, "pb-msg");
    });
}

/* ==========================================================================
   DRUM KIT TABLE BUILDER
   ========================================================================== */
function initDrumVisualizer() {
    if (!drumKeySelect) return;
    drumKeySelect.innerHTML = "";
    if (typeof DRUM_KEY_MAP !== 'undefined') {
        DRUM_KEY_MAP.forEach((item, index) => {
            let opt = document.createElement('option'); 
            opt.value = index;
            opt.innerHTML = `Key ${item.key} (KeyN: ${item.name})`; 
            drumKeySelect.appendChild(opt);
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
    const d = DRUM_KEY_MAP[index]; 
    if (!d) return;
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
