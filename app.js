/* ==========================================================================
   ROLAND FP-30X WEB CONTROLLER - APP.JS (SOLID STABLE VERSION)
   ========================================================================== */

let midiAccess = null;
let midiOutput = null;
const MIDI_CHANNEL = 3; // Channel 4 hardware (0xB3 for CC)

const CONTROLLERS = [
    { id: 'cc1',  num: 1,  default: 0 },
    { id: 'cc5',  num: 5,  default: 0 },
    { id: 'cc7',  num: 7,  default: 100 },
    { id: 'cc10', num: 10, default: 64 },
    { id: 'cc11', num: 11, default: 127 },
    { id: 'cc65', num: 65, default: 0 },
    { id: 'cc71', num: 71, default: 64 },
    { id: 'cc72', num: 72, default: 64 },
    { id: 'cc73', num: 73, default: 64 },
    { id: 'cc74', num: 74, default: 64 },
    { id: 'cc75', num: 75, default: 64 },
    { id: 'cc76', num: 76, default: 64 },
    { id: 'cc77', num: 77, default: 64 },
    { id: 'cc78', num: 78, default: 64 },
    { id: 'cc84', num: 84, default: 0 },
    { id: 'cc91', num: 91, default: 40 },
    { id: 'cc93', num: 93, default: 0 }
];

const statusDiv = document.getElementById('status');
const midiPortSelect = document.getElementById('midiPortSelect');
const btnRefreshMidi = document.getElementById('btnRefreshMidi');

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

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteName(noteNumber) {
    const octave = Math.floor(noteNumber / 12) - 1;
    return `${NOTE_NAMES[noteNumber % 12]}${octave}`;
}

function handleMidiInput(event) {
    const data = event.data;
    if (!data || data.length < 1) return;

    const command = data[0] & 0xF0;
    const channel = (data[0] & 0x0F) + 1;
    
    let logText = ""; 
    let cssClass = "system-msg";
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    switch (command) {
        case 0x90:
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
        case 0x80:
            if (data.length < 2) return;
            const noteOffName = getNoteName(data[1]);
            logText = `[${timestamp}] IN (Ch.${channel}) | Note Off: ${noteOffName} (KeyN: ${data[1]})`;
            cssClass = "note-off";
            break;
        case 0xB0:
            if (data.length < 3) return;
            logText = `[${timestamp}] IN (Ch.${channel}) | CC Recv : Controller ${data[1]}, Value: ${data[2]}`;
            cssClass = "cc-msg";
            break;
        case 0xC0:
            if (data.length < 2) return;
            logText = `[${timestamp}] IN (Ch.${channel}) | Prog Recv: Instrument ID ${data[1] + 1} (PC: ${data[1]})`;
            cssClass = "pb-msg";
            break;
        case 0xE0:
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

function updateMidiPortList() {
    if (!midiAccess || !midiPortSelect) return;
    midiPortSelect.innerHTML = "";
    const outputs = Array.from(midiAccess.outputs.values());
    
    if (outputs.length === 0) {
        midiPortSelect.innerHTML = '<option value="">No MIDI Output Devices Found</option>';
        if (statusDiv) {
            statusDiv.innerHTML = "No MIDI Output hardware found. Connect FP-30X via USB.";
            statusDiv.style.background = "#e65100";
        }
        return;
    }

    outputs.forEach(output => {
        let opt = document.createElement('option');
        opt.value = output.id;
        opt.innerText = output.name;
        if (midiOutput && midiOutput.id === output.id) opt.selected = true;
        midiPortSelect.appendChild(opt);
    });

    if (!midiOutput || !outputs.some(o => o.id === midiOutput.id)) {
        let preferred = outputs.find(o => o.name.toLowerCase().includes('fp-30x') || o.name.toLowerCase().includes('roland')) || outputs[0];
        midiOutput = preferred;
        if (midiPortSelect) midiPortSelect.value = preferred.id;
    }

    if (midiOutput && statusDiv) {
        statusDiv.innerHTML = `Connected Hardware (Active In/Out): ${midiOutput.name}`;
        statusDiv.style.background = "#2e7d32";
    }
}

if (midiPortSelect) {
    midiPortSelect.addEventListener('change', () => {
        if (!midiAccess) return;
        const selectedId = midiPortSelect.value;
        const outputs = Array.from(midiAccess.outputs.values());
        midiOutput = outputs.find(o => o.id === selectedId) || null;
        if (midiOutput && statusDiv) {
            statusDiv.innerHTML = `Connected Hardware (Active In/Out): ${midiOutput.name}`;
            statusDiv.style.background = "#2e7d32";
            appendOutputLog(`Switched active output to: ${midiOutput.name}`, "system-msg");
        }
    });
}

if (btnRefreshMidi) {
    btnRefreshMidi.addEventListener('click', () => {
        updateMidiPortList();
        appendOutputLog("Refreshed MIDI port list", "system-msg");
    });
}

// DROPDOWNS SOUND SELECTION
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

// REVERB TYPE
if (reverbTypeSelect) {
    reverbTypeSelect.addEventListener('change', () => {
        if (!midiOutput) return;
        const typeVal = parseInt(reverbTypeSelect.value);
        const sysexMsg = [0xF0, 0x7F, 0x7F, 0x04, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, typeVal, 0xF7];
        try {
            midiOutput.send(sysexMsg);
            appendOutputLog(`SysEx Sent: Reverb Type = ${reverbTypeSelect.options[reverbTypeSelect.selectedIndex].text}`, "cc-msg");
        } catch(e) {
            appendOutputLog(`SysEx Reverb Type blocked by browser`, "system-msg");
        }
    });
}

// SEND CC LOGIC
function sendCC(ccNum, value) {
    if (!midiOutput) return;
    
    if (ccNum === 7 || ccNum === 91 || ccNum === 93) {
        for (let ch = 0; ch < 16; ch++) {
            midiOutput.send([0xB0 | ch, ccNum, value]);
        }
        if (ccNum === 91) {
            try {
                midiOutput.send([0xF0, 0x7F, 0x7F, 0x04, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, value, 0xF7]);
            } catch(e) {}
        }
    } else {
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

// AUX BUTTONS
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

// PRESETS
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

        if (state.reverbType && reverbTypeSelect) {
            reverbTypeSelect.value = state.reverbType;
            reverbTypeSelect.dispatchEvent(new Event('change'));
        }

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

// PROGRAM CHANGE TRANSMISSION
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

        midiOutput.send([0xB0 | 0, 0, s.cc00]); 
        midiOutput.send([0xB0 | 0, 32, s.cc32]); 
        midiOutput.send([0xC0 | 0, s.pc]);
        
        appendOutputLog(`Prog Sent: ${s.name} [MSB:${s.cc00} LSB:${s.cc32} PC:${s.pc + 1}]`, "pb-msg");
    });
}

// DRUM KIT TABLE BUILDER
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

function onMIDISuccess(access) {
    midiAccess = access;
    updateMidiPortList();

    const inputs = Array.from(midiAccess.inputs.values());
    inputs.forEach(input => {
        if (input.name.toLowerCase().includes('fp-30x') || input.name.toLowerCase().includes('roland') || inputs.length === 1) {
            input.onmidimessage = handleMidiInput;
        }
    });
}

function onMIDIFailure() {
    if (statusDiv) {
        statusDiv.innerHTML = "MIDI Hardware access failed or denied by browser.";
        statusDiv.style.background = "#d32f2f";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initDrumVisualizer();
    setupControllerListeners();

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess).catch(() => {
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        });
    } else if (statusDiv) {
        statusDiv.innerHTML = "Error: Unsupported browser. Use Chrome or Edge on HTTPS/Localhost.";
        statusDiv.style.background = "#d32f2f";
    }
});
