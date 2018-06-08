

function Worker() {
    self.onmessage = function (event) {
        setTimeout(function () {
            postMessage({args: event.data.args});
        }, event.data.delay);
    }
}

Dialog_AudioEngineWeb = function () {
    this.threshold = 1000;
    this.worker = new Worker("workerTimer.js");
    var self = this;
    this.worker.onmessage = function (event) {
        if (event.data.args)
            if (event.data.args.action == 0) {
                self.actualPlay(event.data.args.id, event.data.args.vol, event.data.args.time, event.data.args.part_id);
            }
            else {
                self.actualStop(event.data.args.id, event.data.args.time, event.data.args.part_id);
            }
    }
};

Dialog_AudioEngineWeb.prototype = new AudioEngine();

Dialog_AudioEngineWeb.prototype.init = function (cb) {
    AudioEngine.prototype.init.call(this);

    this.context = new AudioContext();

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    this.masterGain.gain.value = this.volume;
        
    this.limiterNode = this.context.createDynamicsCompressor();
    this.limiterNode.threshold.value = -10;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0;
    this.limiterNode.release.value = 0.1;
    this.limiterNode.connect(this.masterGain);

    // for synth mix
    this.pianoGain = this.context.createGain();
    this.pianoGain.gain.value = 0.5;
    this.pianoGain.connect(this.limiterNode);
    this.synthGain = this.context.createGain();
    this.synthGain.gain.value = 0.5;
    this.synthGain.connect(this.limiterNode);

    this.playings = {};

    if (cb) setTimeout(cb, 0);

    //set contextHighlight
    contextHighlight = this.context;
    return this;
};

Dialog_AudioEngineWeb.prototype.load = function (id, url, cb) {
    var audio = this;
    var req = new XMLHttpRequest();

    var newUrl = url;
    req.open("GET", newUrl);
    req.responseType = "arraybuffer";
    req.addEventListener("readystatechange", function (evt) {
        if (req.readyState !== 4) return;
        try {
            audio.context.decodeAudioData(req.response, function (buffer) {
                audio.sounds[id] = buffer;
                if (cb) cb();
            });
        } catch (e) {
            new Notification({
                id: "audio-download-error", title: "Problem", text: "For some reason, an audio download failed with a status of " + req.status + ". ",
                target: "#piano", duration: 10000
            });
        }
    });
    req.send();
};

Dialog_AudioEngineWeb.prototype.actualPlay = function (id, vol, time, part_id) { //the old play(), but with time insted of delay_ms.
    if (!this.sounds.hasOwnProperty(id)) return;
    var source = this.context.createBufferSource();
    source.buffer = this.sounds[id];
    var gain = this.context.createGain();
    gain.gain.value = vol;
    source.connect(gain);
    gain.connect(this.pianoGain);
    source.start(time);
    // Patch from ste-art remedies stuttering under heavy load
    if (this.playings[id]) {
        var playing = this.playings[id];
        
        playing.gain.gain.setValueAtTime(playing.gain.gain.value, time);
        playing.gain.gain.linearRampToValueAtTime(0.0, time + 0.1);
        playing.source.stop(time + 0.01);
        if (enableSynth && playing.voice) {
            playing.voice.stop(time);
        }
    }
    this.playings[id] = {"source": source, "gain": gain, "part_id": part_id};

    if (enableSynth) {
        this.playings[id].voice = new synthVoice(id, time);
    }
}

Dialog_AudioEngineWeb.prototype.play = function (id, vol, delay_ms, part_id) {
    if (!this.sounds.hasOwnProperty(id)) return;
    var time = this.context.currentTime + (delay_ms / 1000); //calculate time on note receive.
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualPlay(id, vol, time, part_id);
    else {
        // this.worker.postMessage({delay: delay, args: {action: 0/*play*/, id: id, vol: vol, time: time, part_id: part_id}}); // but start scheduling right before play.
    }
}

Dialog_AudioEngineWeb.prototype.actualStop = function (id, time, part_id) {
    if (this.playings.hasOwnProperty(id) && this.playings[id] && this.playings[id].part_id === part_id) {
        var gain = this.playings[id].gain.gain;
        gain.setValueAtTime(gain.value, time);
        gain.linearRampToValueAtTime(gain.value * 0.1, time + 0.1);
        gain.linearRampToValueAtTime(0.0, time + 0.1);
        this.playings[id].source.stop(time + 0.1);


        if (this.playings[id].voice) {
            this.playings[id].voice.stop(time);
        }

        this.playings[id] = null;
    }
};

Dialog_AudioEngineWeb.prototype.stop = function (id, delay_ms, part_id) {
    var time = this.context.currentTime + (delay_ms / 1000);
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualStop(id, time, part_id);
    else {
        // this.worker.postMessage({delay: delay, args: {action: 1/*stop*/, id: id, time: time, part_id: part_id}});
    }
};

Dialog_AudioEngineWeb.prototype.setVolume = function (vol) {
    AudioEngine.prototype.setVolume.call(this, vol);
    this.masterGain.gain.value = this.volume;
};

// Renderer classes

////////////////////////////////////////////////////////////////

var Dialog_Renderer = function () {
};

Dialog_Renderer.prototype.init = function (dialog_piano) {
    this.dialog_piano = dialog_piano;

    this.resize();
    return this;
};

Dialog_Renderer.prototype.resize = function (width, height) {

    var windowWidth88Percent = $(window).width() * 0.88; // test_piano = 90%

    if (typeof width == "undefined") width = windowWidth88Percent; //1370;
    if (typeof height == "undefined") height = Math.floor(width * 0.2);
    $(this.dialog_piano.rootElement).css({"height": height + "px", marginTop: 10 + "px"});
    this.dialog_width = width;
    this.dialog_height = height;
};

Dialog_Renderer.prototype.visualize = function (key, color) {
};


var Dialog_CanvasRenderer = function () {
    Dialog_Renderer.call(this);
};

Dialog_CanvasRenderer.prototype = new Dialog_Renderer();

Dialog_CanvasRenderer.prototype.init = function (dialog_piano) {
    this.dialog_canvas = document.createElement("canvas");
    this.ctx = this.dialog_canvas.getContext("2d");
    dialog_piano.rootElement.appendChild(this.dialog_canvas);

    Dialog_Renderer.prototype.init.call(this, dialog_piano); // calls resize()

    // create render loop
    var self = this;
    var dialog_render = function () {


        self.redraw();
        requestAnimationFrame(dialog_render);
    };
    requestAnimationFrame(dialog_render);

    // add event listeners
    var mouse_down = false;
    var last_key = null;
    $(dialog_piano.rootElement).mousedown(function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();

        var pos = Dialog_CanvasRenderer.translateMouseEvent(event);
        var hit = self.getDialogHit(pos.x, pos.y);
        if (hit) {
            dialog_press(hit.key.note, hit.v);
            last_key = hit.key;
        }
    });

    $(document).on('mouseup', function (event) {
        $(dialog_piano.rootElement).off('mousemove');
    });

    dialog_piano.rootElement.addEventListener("touchstart", function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();
        for (var i in event.changedTouches) {
            var pos = Dialog_CanvasRenderer.translateMouseEvent(event.changedTouches[i]);
            var hit = self.getDialogHit(pos.x, pos.y);
            if (hit) {
                dialog_press(hit.key.note, hit.v);
                last_key = hit.key;
            }
        }
    }, false);
    $(window).mouseup(function (event) {
        if (last_key) {
            dialog_release(last_key.note);
        }
        mouse_down = false;
        last_key = null;
    });
    
    return this;
};

Dialog_CanvasRenderer.prototype.resize = function (width, height) {
    Dialog_Renderer.prototype.resize.call(this, width, height);
    if (this.dialog_width < 52 * 2) this.dialog_width = 52 * 2;
    if (this.dialog_height < this.dialog_width * 0.2) this.dialog_height = Math.floor(this.dialog_width * 0.2);
    this.dialog_canvas.width = this.dialog_width;
    this.dialog_canvas.height = this.dialog_height;

    // calculate key sizes
    this.dialog_whiteKeyWidth = Math.floor((this.dialog_width / 52) * 1000)/1000;
    this.dialog_whiteKeyHeight = Math.floor(this.dialog_height * 0.9);
    this.dialog_blackKeyWidth = Math.floor(this.dialog_whiteKeyWidth * 0.75);
    this.dialog_blackKeyHeight = Math.floor(this.dialog_height * 0.5);

    this.dialog_blackKeyOffset = Math.floor(this.dialog_whiteKeyWidth - (this.dialog_blackKeyWidth / 2));
    this.dialog_keyMovement = Math.floor(this.dialog_whiteKeyHeight * 0.015);

    this.dialog_whiteBlipWidth = Math.floor(this.dialog_whiteKeyWidth * 0.7);
    this.dialog_whiteBlipHeight = Math.floor(this.dialog_whiteBlipWidth * 0.8);
    this.dialog_whiteBlipX = Math.floor((this.dialog_whiteKeyWidth - this.dialog_whiteBlipWidth) / 2);
    this.dialog_whiteBlipY = Math.floor(this.dialog_whiteKeyHeight - this.dialog_whiteBlipHeight * 1.2);
    this.dialog_blackBlipWidth = Math.floor(this.dialog_blackKeyWidth * 0.7);
    this.dialog_blackBlipHeight = Math.floor(this.dialog_blackBlipWidth * 0.8);
    this.dialog_blackBlipY = Math.floor(this.dialog_blackKeyHeight - this.dialog_blackBlipHeight * 1.2);
    this.dialog_blackBlipX = Math.floor((this.dialog_blackKeyWidth - this.dialog_blackBlipWidth) / 2);

    // prerender white key
    this.dialog_whiteKeyRender = document.createElement("canvas");
    this.dialog_whiteKeyRender.width = this.dialog_whiteKeyWidth;
    this.dialog_whiteKeyRender.height = this.dialog_height + 10;
    var ctx = this.dialog_whiteKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.dialog_whiteKeyHeight);
        gradient.addColorStop(0, "#eee");
        gradient.addColorStop(0.75, "#fff");
        gradient.addColorStop(1, "#dad4d4");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#fff";
    }
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 10;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.dialog_whiteKeyWidth - ctx.lineWidth, this.dialog_whiteKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.dialog_whiteKeyWidth - ctx.lineWidth, this.dialog_whiteKeyHeight - ctx.lineWidth);

    // prerender black key
    this.dialog_blackKeyRender = document.createElement("canvas");
    this.dialog_blackKeyRender.width = this.dialog_blackKeyWidth + 10;
    this.dialog_blackKeyRender.height = this.dialog_blackKeyHeight + 10;
    var ctx = this.dialog_blackKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.dialog_blackKeyHeight);
        gradient.addColorStop(0, "#000");
        gradient.addColorStop(1, "#444");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#000";
    }
    ctx.strokeStyle = "#222";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.dialog_blackKeyWidth - ctx.lineWidth, this.dialog_blackKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.dialog_blackKeyWidth - ctx.lineWidth, this.dialog_blackKeyHeight - ctx.lineWidth);

    // prerender shadows
    this.shadowRender = [];
    var y = -this.dialog_canvas.height * 2;
    for (var j = 0; j < 2; j++) {
        var canvas = document.createElement("canvas");
        this.shadowRender[j] = canvas;
        canvas.width = this.dialog_canvas.width;
        canvas.height = this.dialog_canvas.height;
        var ctx = canvas.getContext("2d");
        var sharp = j ? true : false;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = this.dialog_keyMovement * 3;
        ctx.shadowOffsetY = -y + this.dialog_keyMovement;
        if (sharp) {
            ctx.shadowOffsetX = this.dialog_keyMovement;
        } else {
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = -y + this.dialog_keyMovement;
        }
        for (var i in this.dialog_piano.keys) {
            if (!this.dialog_piano.keys.hasOwnProperty(i)) continue;
            var key = this.dialog_piano.keys[i];
            if (key.sharp != sharp) continue;

            if (key.sharp) {
                ctx.fillRect(this.dialog_blackKeyOffset + this.dialog_whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
                    y + ctx.lineWidth / 2,
                    this.dialog_blackKeyWidth - ctx.lineWidth, this.dialog_blackKeyHeight - ctx.lineWidth);
            } else {
                ctx.fillRect(this.dialog_whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
                    y + ctx.lineWidth / 2,
                    this.dialog_whiteKeyWidth - ctx.lineWidth, this.dialog_whiteKeyHeight - ctx.lineWidth);
            }
        }
    }

    // update key rects
    for (var i in this.dialog_piano.keys) {
        if (!this.dialog_piano.keys.hasOwnProperty(i)) continue;
        var key = this.dialog_piano.keys[i];
        if (key.sharp) {
            key.rect = new Rect(this.dialog_blackKeyOffset + this.dialog_whiteKeyWidth * key.spatial, 0,
                this.dialog_blackKeyWidth, this.dialog_blackKeyHeight);
        } else {
            key.rect = new Rect(this.dialog_whiteKeyWidth * key.spatial, 0,
                this.dialog_whiteKeyWidth, this.dialog_whiteKeyHeight);
        }
    }
};

Dialog_CanvasRenderer.prototype.visualize = function (key, color) {
    key.timePlayed = Date.now();

    var selectedKey = this.dialog_piano.keys[key.note];

    if(selectedKey.selected == 0)
    {
        this.dialog_piano.keys[key.note].selected = 1;

        key.blips.push({"time": key.timePlayed, "color": color});
    }else
    {
        this.dialog_piano.keys[key.note].selected = 0;

        key.blips.pop();
    }
    
    console.log(selectedKey.selected);
};

Dialog_CanvasRenderer.prototype.redraw = function () {
    var now = Date.now();
    var timeLoadedEnd = now - 1000;
    var timePlayedEnd = now - 100;
    var timeBlipEnd = now - 1000;

    if(bShowDialog == false)
        return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.dialog_canvas.width, this.dialog_canvas.height);
    // draw all keys
    for (var j = 0; j < 2; j++) {
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.shadowRender[j], 0, 0);
        var sharp = j ? true : false;
        for (var i in this.dialog_piano.keys) {
            if (!this.dialog_piano.keys.hasOwnProperty(i)) continue;
            var key = this.dialog_piano.keys[i];
            if (key.sharp != sharp) continue;

            
            this.ctx.globalAlpha = 1.0;
            
            var y = 0;
            if (key.timePlayed > timePlayedEnd) {
                y = Math.floor(this.dialog_keyMovement - (((now - key.timePlayed) / 100) * this.dialog_keyMovement));
            }
            var x = Math.floor(key.sharp ? this.dialog_blackKeyOffset + this.dialog_whiteKeyWidth * key.spatial
                : this.dialog_whiteKeyWidth * key.spatial);
            var image = key.sharp ? this.dialog_blackKeyRender : this.dialog_whiteKeyRender;
            this.ctx.drawImage(image, x, y);

            // render blips
            if (key.selected == 1) {
                var alpha = this.ctx.globalAlpha;
                var w, h;
                if (key.sharp) {
                    x += this.dialog_blackBlipX;
                    y = this.dialog_blackBlipY;
                    w = this.dialog_blackBlipWidth;
                    h = this.dialog_blackBlipHeight;
                } else {
                    x += this.dialog_whiteBlipX;
                    
                    y = this.dialog_whiteBlipY;
                    w = this.dialog_whiteBlipWidth;
                    h = this.dialog_whiteBlipHeight;
                }
                

                if(key.sharp)
                {
                    
                    this.ctx.fillStyle = "#F00";
                    
                    this.ctx.fillRect(x, 3, w, this.dialog_blackKeyHeight - 6);
                    
                }else
                {
                   
                    this.ctx.fillStyle = "#F00";
                   
                    this.ctx.fillRect(x, 3, w, this.dialog_whiteKeyHeight - 6);
                    
                }

                 y -= Math.floor(h * 1.1);
                
            }
        }
    }
    this.ctx.restore();
};

Dialog_CanvasRenderer.prototype.getDialogHit = function (x, y) {
    for (var j = 0; j < 2; j++) {
        var sharp = j ? false : true; // black keys first
        for (var i in this.dialog_piano.keys) {
            if (!this.dialog_piano.keys.hasOwnProperty(i)) continue;
            var key = this.dialog_piano.keys[i];
            if (key.sharp != sharp) continue;
            if (key.rect.contains(x, y)) {
                var v = y / (key.sharp ? this.dialog_blackKeyHeight : this.dialog_whiteKeyHeight);
                v += 0.25;
                v *= DEFAULT_VELOCITY;
                if (v > 1.0) v = 1.0;
                return {"key": key, "v": v};
            }
        }
    }
    return null;
};


Dialog_CanvasRenderer.isSupported = function () {
    var canvas = document.createElement("canvas");
    return !!(canvas.getContext && canvas.getContext("2d"));
};

Dialog_CanvasRenderer.translateMouseEvent = function (evt) {
    var element = evt.target;
    var offx = 0;
    var offy = 0;
    do {
        if (!element) break; // wtf, wtf?
        offx += element.offsetLeft;
        offy += element.offsetTop;
    } while (element = element.offsetParent);
    return {
        x: evt.pageX - offx,
        y: evt.pageY - offy
    }
};


// Pianoctor

////////////////////////////////////////////////////////////////

var Dialog_PianoKey = function (note, octave) {
    this.note = note + octave;
    this.baseNote = note;
    this.octave = octave;
    this.sharp = note.indexOf("s") != -1;
    this.loaded = false;
    this.timeLoaded = 0;
    this.domElement = null;
    this.timePlayed = 0;
    this.blips = [];
    this.selected = 0;
};

var Dialog_Piano = function (rootElement) {

    var dialog_piano = this;
    dialog_piano.rootElement = rootElement;
    dialog_piano.keys = {};

    var white_spatial = 0;
    var black_spatial = 0;
    var black_it = 0;
    var black_lut = [2, 1, 2, 1, 1];
    var addKey = function (note, octave, nVal) {
        var key = new Dialog_PianoKey(note, octave);
        dialog_piano.keys[key.note] = key;
        dialog_piano.keys[key.note].selected = nVal;
        if (key.sharp) {
            key.spatial = black_spatial;
            black_spatial += black_lut[black_it % 5];
            ++black_it;
        } else {
            key.spatial = white_spatial;
            ++white_spatial;
        }
    }
    
    addKey("a", -1, 0);
    addKey("as", -1, 0);
    addKey("b", -1 , 0);
    var notes = "c cs d ds e f fs g gs a as b".split(" ");
    for (var oct = 0; oct < 7; oct++) {
        for (var i in notes) {
            addKey(notes[i], oct, 0);
        }
    }
    addKey("c", 7, 0);
    
    
    var arrSelect = JSON.parse(localStorage.getItem("arrSelect"));
    
    if(arrSelect !== 'undefined' && arrSelect != null)
    {
        var nIndex = 0;
        for (var i in dialog_piano.keys) {
            dialog_piano.keys[i].selected = arrSelect[nIndex];

            nIndex ++;
        }
    }else
    {

    }



    this.dialog_renderer = new Dialog_CanvasRenderer().init(this);

    window.AudioContext = window.AudioContext || window.webkitAudioContext || undefined;
    var audio_engine = Dialog_AudioEngineWeb;

    this.audio = new audio_engine().init(function () {
        for (var i in dialog_piano.keys) {
            if (!dialog_piano.keys.hasOwnProperty(i)) continue;
            (function () {
                var key = dialog_piano.keys[i];
                dialog_piano.audio.load(key.note, gSoundPath + key.note + gSoundExt, function () {
                    key.loaded = true;
                    key.timeLoaded = Date.now();
                    if (key.domElement) // todo: move this to renderer somehow
                        $(key.domElement).removeClass("loading");
                });
            })();
        }
    });
};

Dialog_Piano.prototype.play = function (note, vol, participant, delay_ms) {
    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];

    if (key.loaded) this.audio.play(key.note, vol, delay_ms, participant.id);
    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, vol * 100, delay_ms);
    var self = this;
    var jq_namediv = $(typeof participant == "undefined" ? null : participant.nameDiv);
    if (jq_namediv) {
        setTimeout(function () {
            self.dialog_renderer.visualize(key, typeof participant == "undefined" ? "yellow" : "#777");
            jq_namediv.addClass("play");
            setTimeout(function () {
                jq_namediv.removeClass("play");
            }, 30);
        }, delay_ms);
    }
};

Dialog_Piano.prototype.stop = function (note, participant, delay_ms) {
    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];
    if (key.loaded) this.audio.stop(key.note, delay_ms, participant.id);
    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, 0, delay_ms);
};

var gDialog_Piano = new Dialog_Piano(document.getElementById("pianos"));

var gAutoSustain = false;
var gSustain = false;

var gHeldNotes = {};
var gSustainedNotes = {};

function dialog_press(id, vol) {
    for (var ids in gSustainedNotes) {
            if (gSustainedNotes.hasOwnProperty(ids) && gSustainedNotes[ids] && !gHeldNotes[ids]) {
                gSustainedNotes[ids] = false;
                
            }
        }
    if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {

        
        gHeldNotes[id] = true;
        gSustainedNotes[id] = true;
        gDialog_Piano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);
        
    }
}

function dialog_release(id) {
    if (gHeldNotes[id]) {
        gHeldNotes[id] = false;
        if ((gAutoSustain || gSustain) && !enableSynth) {
            gSustainedNotes[id] = true;
        } else {
            if (gNoteQuota.spend(1)) {
                gDialog_Piano.stop(id, gClient.getOwnParticipant(), 0);
                gClient.stopNote(id);
                gSustainedNotes[id] = false;
            }
        }
    }
}


function dialog_releaseSustain() {
    gSustain = false;
    if (!gAutoSustain) {
        for (var id in gSustainedNotes) {
            if (gSustainedNotes.hasOwnProperty(id) && gSustainedNotes[id] && !gHeldNotes[id]) {
                gSustainedNotes[id] = false;
                if (gNoteQuota.spend(1)) {
                    gDialog_Piano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                }
            }
        }
    }
}


// internet science

////////////////////////////////////////////////////////////////

volume_slider.set(gDialog_Piano.audio.volume);

function dialog_handleKeyDown(evt) {
    //console.log(evt);
    var code = parseInt(evt.keyCode);
    if (key_binding[code] !== undefined) {
        var binding = key_binding[code];
        if (!binding.held) {
            binding.held = true;

            var note = binding.note;
            var octave = 1 + note.octave + transpose_octave;
            if (evt.shiftKey) ++octave;
            else if (capsLockKey || evt.ctrlKey) --octave;
            note = note.note + octave;
            var vol = velocityFromMouseY();
            dialog_press(note, vol);
        }

        if (++gKeyboardSeq == 3) {
            gKnowsYouCanUseKeyboard = true;
            if (window.gKnowsYouCanUseKeyboardTimeout) clearTimeout(gKnowsYouCanUseKeyboardTimeout);
            if (localStorage) localStorage.knowsYouCanUseKeyboard = true;
            if (window.gKnowsYouCanUseKeyboardNotification) gKnowsYouCanUseKeyboardNotification.close();
        }

        evt.preventDefault();
        evt.stopPropagation();
        return false;
    } else if (code == 20) { // Caps Lock
        capsLockKey = true;
        evt.preventDefault();
    } else if (code === 0x20) { // Space Bar
        pressSustain();
        evt.preventDefault();
    } else if ((code === 38 || code === 39) && transpose_octave < 3) {
        ++transpose_octave;
    } else if ((code === 40 || code === 37) && transpose_octave > -2) {
        --transpose_octave;
    } else if (code == 9) { // Tab (don't tab away from the piano)
        evt.preventDefault();
    } else if (code == 8) { // Backspace (don't navigate Back)
        gAutoSustain = !gAutoSustain;
        evt.preventDefault();
    }
};

function dialog_handleKeyUp(evt) {
    var code = parseInt(evt.keyCode);
    if (key_binding[code] !== undefined) {
        var binding = key_binding[code];
        if (binding.held) {
            binding.held = false;

            var note = binding.note;
            var octave = 1 + note.octave + transpose_octave;
            if (evt.shiftKey) ++octave;
            else if (capsLockKey || evt.ctrlKey) --octave;
            note = note.note + octave;
            dialog_release(note);
        }

        evt.preventDefault();
        evt.stopPropagation();
        return false;
    } else if (code == 20) { // Caps Lock
        capsLockKey = false;
        evt.preventDefault();
    } else if (code === 0x20) { // Space Bar
        dialog_releaseSustain();
        evt.preventDefault();
    }
};

function dialog_handleKeyPress(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.keyCode == 27 || evt.keyCode == 13) {
        //$("#chat input").focus();
    }
    return false;
};

var dialog_recapListener = function (evt) {
    captureKeyboard();
};

function dialog_captureKeyboard() {
    $("#pianos").off("mousedown", dialog_recapListener);
    $("#pianos").off("touchstart", dialog_recapListener);
    $(document).on("keydown", dialog_handleKeyDown);
    $(document).on("keyup", dialog_handleKeyUp);
    $(window).on("keypress", dialog_handleKeyPress);
};

function dialog_releaseKeyboard() {
    $(document).off("keydown", dialog_handleKeyDown);
    $(document).off("keyup", dialog_handleKeyUp);
    $(window).off("keypress", dialog_handleKeyPress);
    $("#pianos").on("mousedown", dialog_recapListener);
    $("#pianos").on("touchstart", dialog_recapListener);
};

dialog_captureKeyboard();


if (window.localStorage) {

    window.gHasBeenHereBefore = (localStorage.gHasBeenHereBefore || false);
    if (gHasBeenHereBefore) {
        gDialog_Piano.audio.setVolume(localStorage.volume);
    }
    localStorage.gHasBeenHereBefore = true;
}

// API
window.MPP = {
    press: dialog_press,
    release: dialog_release,
    dialog_piano: gDialog_Piano,
    client: gClient,
    chat: chat,
    noteQuota: gNoteQuota
};
