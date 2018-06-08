// AudioEngine classes

////////////////////////////////////////////////////////////////

var correctBuff = 0;
var wrongBuff = 0;

function Worker() {
    self.onmessage = function (event) {
        setTimeout(function () {
            postMessage({args: event.data.args});
        }, event.data.delay);
    }
}

Test_AudioEngineWeb = function () {
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

Test_AudioEngineWeb.prototype = new AudioEngine();

Test_AudioEngineWeb.prototype.init = function (cb) {
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

    // set contextTest;
    contextTest = this.context;

    // create audio for test correct and Incorrect
    correctAudio = new Audio(gSoundPath + "x0" + gSoundExt);
    correctAudio.preload = 'auto';
    correctAudio.muted = true;
    correctAudio.play();

    incorrectAudio = new Audio(gSoundPath + "y0" + gSoundExt);
    incorrectAudio.preload = 'auto';
    incorrectAudio.muted = true;
    incorrectAudio.play();

    // create audio context for initial sound play
    correctSoundContext = new AudioContext();
    incorrectSoundContext = new AudioContext();

    return this;
};

Test_AudioEngineWeb.prototype.load = function (id, url, cb) {
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
                audio.soundsUrl[id] = url; // added by Zhang to save mp3 URL
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

Test_AudioEngineWeb.prototype.effectLoad = function (id, url, cb) {
    var audio = this;
    var req = new XMLHttpRequest();

    var newUrl = url;
    req.open("GET", newUrl);
    req.responseType = "arraybuffer";
    req.addEventListener("readystatechange", function (evt) {
        if (req.readyState !== 4) return;
        try {
            audio.context.decodeAudioData(req.response, function (buffer) {

                if(id == "x0")
                {
                    correctBuff = buffer;
                }

                if(id == "y0")
                {
                    wrongBuff = buffer;
                }
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

function canplayMidi() {

    var canplayMidi = false;
    if(MIDI_LIST) {
        if (MIDI_LIST.outputs.size > 0) {
            var outputs = MIDI_LIST.outputs.values();
            for (var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
                var output = output_it.value;
                if(output.enabled) {
                    canplayMidi = true;
                    break;
                }
            }
        }
    }

    return canplayMidi;
}

Test_AudioEngineWeb.prototype.actualPlay = function (id, vol, time, part_id) { //the old play(), but with time insted of delay_ms.

    if (!this.sounds.hasOwnProperty(id)) return;

    if (false == canplayMidi()) {

        var mp3Audio = new Audio(this.soundsUrl[id]);
        mp3Audio.volume = vol;
        mp3Audio.play();

        setTimeout(function(){
            mp3Audio.muted = true;
        }, 300);

    } else {

        if(MIDI_COMPUTER_SOUND_ON_OFF == 'on') {

            var source = this.context.createBufferSource();
            source.buffer = this.sounds[id];
            var gain = this.context.createGain();
            gain.gain.value = vol;
            source.connect(gain);
            gain.connect(this.pianoGain);
            source.start(time);

            //Patch from ste-art remedies stuttering under heavy load
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
        } else {

            var source = this.context.createBufferSource();
            source.buffer = this.sounds[id];
            var gain = this.context.createGain();
            gain.gain.value = vol;
            source.connect(gain);
            gain.connect(this.pianoGain);
            source.start(time);

            //Patch from ste-art remedies stuttering under heavy load
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

    }

}

Test_AudioEngineWeb.prototype.actualEffectPlay = function (id, vol, time, part_id) { //the old play(), but with time insted of delay_ms.
    
    var source = this.context.createBufferSource();

    if(id == "x0")
    {
        source.buffer = correctBuff;
    }

    if(id == "y0")
    {
        source.buffer = wrongBuff;
    }
    
    var gain = this.context.createGain();
    gain.gain.value = vol;
    source.connect(gain);
    gain.connect(this.pianoGain);
    source.start(0);

    if(id == "y0")
    {
        setTimeout(function(){
            gain.gain.setValueAtTime(gain.gain.value, time);
            gain.gain.linearRampToValueAtTime(0.0, 0);
            source.stop(0);
        }, 3000);
    }else
    {
        setTimeout(function(){
            gain.gain.setValueAtTime(gain.gain.value, time);
            gain.gain.linearRampToValueAtTime(0.0, 0);
            source.stop(0);
        }, 1000);
    }
    
    // Patch from ste-art remedies stuttering under heavy load
}

Test_AudioEngineWeb.prototype.play = function (id, vol, delay_ms, part_id) {
    if (!this.sounds.hasOwnProperty(id)) return;
    var time = this.context.currentTime + (delay_ms / 1000); //calculate time on note receive.
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualPlay(id, vol, time, part_id);
    else {
        
    }
}

Test_AudioEngineWeb.prototype.actualStop = function (id, time, part_id) {
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

Test_AudioEngineWeb.prototype.stop = function (id, delay_ms, part_id) {
    var time = this.context.currentTime + (delay_ms / 1000);
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualStop(id, time, part_id);
    else {
        // this.worker.postMessage({delay: delay, args: {action: 1/*stop*/, id: id, time: time, part_id: part_id}});
    }
};

Test_AudioEngineWeb.prototype.setVolume = function (vol) {
    AudioEngine.prototype.setVolume.call(this, vol);
    this.masterGain.gain.value = this.volume;
};

var Test_Renderer = function () {
};

Test_Renderer.prototype.init = function (test_piano) {
    this.test_piano = test_piano;

    this.resize();
    return this;
};

Test_Renderer.prototype.resize = function (width, height) {

    var windowWidth88Percent = $(window).width() * 0.88; // test_piano = 90%

    if (typeof width == "undefined") width = windowWidth88Percent; // 1370;
    if (typeof height == "undefined") height = Math.floor(width * 0.2);

    $(this.test_piano.rootElement).css({"height": height + "px", marginTop: 10 + "px"});
    this.test_width = width;
    this.test_height = height;
};


Test_Renderer.prototype.visualize = function (key, color) {
};

var Test_CanvasRenderer = function () {
    Test_Renderer.call(this);
};

Test_CanvasRenderer.prototype = new Test_Renderer();

Test_CanvasRenderer.prototype.init = function (test_piano) {
    this.test_canvas = document.createElement("canvas");
    this.ctx = this.test_canvas.getContext("2d");
    test_piano.rootElement.appendChild(this.test_canvas);

    Test_Renderer.prototype.init.call(this, test_piano); // calls resize()

    // create render loop
    var self = this;
    var test_render = function () {


        self.redraw();
        requestAnimationFrame(test_render);
    };
    requestAnimationFrame(test_render);

    // add event listeners
    var mouse_down = false;
    var last_key = null;
    $(test_piano.rootElement).mousedown(function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();

        var pos = Test_CanvasRenderer.translateMouseEvent(event);
        var hit = self.getTestHit(pos.x, pos.y);
        if (hit) {
            test_press(hit.key.note, hit.v);
            last_key = hit.key;
        }
    });

    $(document).on('mouseup', function (event) {
        $(test_piano.rootElement).off('mousemove');
    });

    test_piano.rootElement.addEventListener("touchstart", function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();
        for (var i in event.changedTouches) {
            var pos = Test_CanvasRenderer.translateMouseEvent(event.changedTouches[i]);
            var hit = self.getTestHit(pos.x, pos.y);
            if (hit) {
                test_press(hit.key.note, hit.v);
                last_key = hit.key;
            }
        }
    }, false);
    $(window).mouseup(function (event) {
        if (last_key) {
            test_release(last_key.note);
        }
        mouse_down = false;
        last_key = null;
    });
    
    return this;
};

Test_CanvasRenderer.prototype.resize = function (width, height) {
    Test_Renderer.prototype.resize.call(this, width, height);

    if (this.test_width < 52 * 2) this.test_width = 52 * 2;
    if (this.test_height < this.test_width * 0.2) this.test_height = Math.floor(this.test_width * 0.2);
    this.test_canvas.width = this.test_width;
    this.test_canvas.height = this.test_height;

    // calculate key sizes
    this.test_whiteKeyWidth = Math.floor((this.test_width / 52) * 1000)/1000;

    this.test_whiteKeyHeight = Math.floor(this.test_height * 0.9);
    this.test_blackKeyWidth = Math.floor(this.test_whiteKeyWidth * 0.75);
    this.test_blackKeyHeight = Math.floor(this.test_height * 0.5);

    this.test_blackKeyOffset = Math.floor(this.test_whiteKeyWidth - (this.test_blackKeyWidth / 2));
    this.test_keyMovement = Math.floor(this.test_whiteKeyHeight * 0.015);

    this.test_whiteBlipWidth = Math.floor(this.test_whiteKeyWidth * 0.7);
    this.test_whiteBlipHeight = Math.floor(this.test_whiteBlipWidth * 0.8);
    this.test_whiteBlipX = Math.floor((this.test_whiteKeyWidth - this.test_whiteBlipWidth) / 2);
    this.test_whiteBlipY = Math.floor(this.test_whiteKeyHeight - this.test_whiteBlipHeight * 1.2);
    this.test_blackBlipWidth = Math.floor(this.test_blackKeyWidth * 0.7);
    this.test_blackBlipHeight = Math.floor(this.test_blackBlipWidth * 0.8);
    this.test_blackBlipY = Math.floor(this.test_blackKeyHeight - this.test_blackBlipHeight * 1.2);
    this.test_blackBlipX = Math.floor((this.test_blackKeyWidth - this.test_blackBlipWidth) / 2);

    // prerender white key
    this.test_whiteKeyRender = document.createElement("canvas");
    this.test_whiteKeyRender.width = this.test_whiteKeyWidth;
    this.test_whiteKeyRender.height = this.test_height + 10;
    var ctx = this.test_whiteKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.test_whiteKeyHeight);
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
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_whiteKeyWidth - ctx.lineWidth, this.test_whiteKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_whiteKeyWidth - ctx.lineWidth, this.test_whiteKeyHeight - ctx.lineWidth);

    // prerender white key
    this.test_whiteYellowKeyRender = document.createElement("canvas");
    this.test_whiteYellowKeyRender.width = this.test_whiteKeyWidth;
    this.test_whiteYellowKeyRender.height = this.test_height + 10;
    var ctx = this.test_whiteYellowKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.test_whiteKeyHeight);
        gradient.addColorStop(0, "#eee");
        gradient.addColorStop(0.75, "#fff");
        gradient.addColorStop(1, "#f2f842");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#fff";
    }
    ctx.strokeStyle = "#000";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 10;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_whiteKeyWidth - ctx.lineWidth, this.test_whiteKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_whiteKeyWidth - ctx.lineWidth, this.test_whiteKeyHeight - ctx.lineWidth);

    // prerender black key
    this.test_blackKeyRender = document.createElement("canvas");
    this.test_blackKeyRender.width = this.test_blackKeyWidth + 10;
    this.test_blackKeyRender.height = this.test_blackKeyHeight + 10;
    var ctx = this.test_blackKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.test_blackKeyHeight);
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
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_blackKeyWidth - ctx.lineWidth, this.test_blackKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_blackKeyWidth - ctx.lineWidth, this.test_blackKeyHeight - ctx.lineWidth);

    // prerender black key
    this.test_blackYellowKeyRender = document.createElement("canvas");
    this.test_blackYellowKeyRender.width = this.test_blackKeyWidth + 10;
    this.test_blackYellowKeyRender.height = this.test_blackKeyHeight + 10;
    var ctx = this.test_blackYellowKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.test_blackKeyHeight);
        gradient.addColorStop(0, "#000");
        gradient.addColorStop(1, "#f2f842");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#000";
    }
    ctx.strokeStyle = "#222";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_blackKeyWidth - ctx.lineWidth, this.test_blackKeyHeight - ctx.lineWidth);
    ctx.lineWidth = 4;
    ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.test_blackKeyWidth - ctx.lineWidth, this.test_blackKeyHeight - ctx.lineWidth);

    // prerender shadows
    this.shadowRender = [];
    var y = -this.test_canvas.height * 2;
    for (var j = 0; j < 2; j++) {
        var canvas = document.createElement("canvas");
        this.shadowRender[j] = canvas;
        canvas.width = this.test_canvas.width;
        canvas.height = this.test_canvas.height;
        var ctx = canvas.getContext("2d");
        var sharp = j ? true : false;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = this.test_keyMovement * 3;
        ctx.shadowOffsetY = -y + this.test_keyMovement;
        if (sharp) {
            ctx.shadowOffsetX = this.test_keyMovement;
        } else {
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = -y + this.test_keyMovement;
        }
        for (var i in this.test_piano.keys) {
            if (!this.test_piano.keys.hasOwnProperty(i)) continue;
            var key = this.test_piano.keys[i];
            if (key.sharp != sharp) continue;

            if (key.sharp) {
                ctx.fillRect(this.test_blackKeyOffset + this.test_whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
                    y + ctx.lineWidth / 2,
                    this.test_blackKeyWidth - ctx.lineWidth, this.test_blackKeyHeight - ctx.lineWidth);
            } else {
                ctx.fillRect(this.test_whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
                    y + ctx.lineWidth / 2,
                    this.test_whiteKeyWidth - ctx.lineWidth, this.test_whiteKeyHeight - ctx.lineWidth);
            }
        }
    }

    // update key rects
    for (var i in this.test_piano.keys) {
        if (!this.test_piano.keys.hasOwnProperty(i)) continue;
        var key = this.test_piano.keys[i];
        if (key.sharp) {
            key.rect = new Rect(this.test_blackKeyOffset + this.test_whiteKeyWidth * key.spatial, 0,
                this.test_blackKeyWidth, this.test_blackKeyHeight);
        } else {
            key.rect = new Rect(this.test_whiteKeyWidth * key.spatial, 0,
                this.test_whiteKeyWidth, this.test_whiteKeyHeight);
        }
    }
};

Test_CanvasRenderer.prototype.visualize = function (key, color) {
    key.timePlayed = Date.now();

    var selectedKey = this.test_piano.keys[key.note];

    key.blips.push({"time": key.timePlayed, "color": color});
    
    console.log(selectedKey.selected);
};

Test_CanvasRenderer.prototype.redraw = function () {
    var now = Date.now();
    var timeLoadedEnd = now - 1000;
    var timePlayedEnd = now - 100;
    var timeBlipEnd = now - 1000;

    var arrSelect = JSON.parse(localStorage.getItem("arrSelect"));
    
    if(arrSelect !== 'undefined' && arrSelect != null)
    {
        var nIndex = 0;
        for (var i in this.test_piano.keys) {

            this.test_piano.keys[i].selected = arrSelect[nIndex];
           
            nIndex ++;
        }
    }else
    {
       for (var i in this.test_piano.keys) {

            this.test_piano.keys[i].selected = 0;
        }
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.test_canvas.width, this.test_canvas.height);
    // draw all keys
    for (var j = 0; j < 2; j++) {
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.shadowRender[j], 0, 0);
        var sharp = j ? true : false;
        for (var i in this.test_piano.keys) {
            if (!this.test_piano.keys.hasOwnProperty(i)) continue;

            var key = this.test_piano.keys[i];

            if (key.sharp != sharp) continue;

            if (!key.loaded || key.selected == 0) {
                this.ctx.globalAlpha = 0.2;
            } else if (key.timeLoaded > timeLoadedEnd) {
                this.ctx.globalAlpha = ((now - key.timeLoaded) / 1000) * 0.8 + 0.2;
            } else {
                this.ctx.globalAlpha = 1.0;
            }
            var y = 0;
            if (key.timePlayed > timePlayedEnd) {
                y = Math.floor(this.test_keyMovement - (((now - key.timePlayed) / 100) * this.test_keyMovement));
            }
            var x = Math.floor(key.sharp ? this.test_blackKeyOffset + this.test_whiteKeyWidth * key.spatial
                : this.test_whiteKeyWidth * key.spatial);

            var image = null;

            if(key.sharp)
            {
                if(key.selected == 0)
                {
                    image =  this.test_blackKeyRender;
                }else
                {
                    image =  this.test_blackYellowKeyRender;
                }
            }else
            {
                if(key.selected == 0)
                {
                    image =  this.test_whiteKeyRender;
                }else
                {
                    image =  this.test_whiteYellowKeyRender;
                }
            }
            
            this.ctx.drawImage(image, x, y);

            // render blips
            if (key.blips.length) {
                var alpha = this.ctx.globalAlpha;
                var w, h;
                if (key.sharp) {
                    x += this.test_blackBlipX;
                    
                    y = this.test_blackBlipY;
                    w = this.test_blackBlipWidth;
                    h = this.test_blackBlipHeight;
                } else {
                    x += this.test_whiteBlipX;
                    
                    y = this.test_whiteBlipY;
                    w = this.test_whiteBlipWidth;
                    h = this.test_whiteBlipHeight;
                }
                for (var b = 0; b < key.blips.length; b++) {
                    var blip = key.blips[b];

                    if(key.sharp)
                    {
                        if (blip.time > timeBlipEnd) {
                            this.ctx.fillStyle = "#f2f842";
                            this.ctx.globalAlpha = alpha - ((now - blip.time) / 1000);
                            this.ctx.fillRect(x, 3, w, this.test_blackKeyHeight - 6);
                        } else {
                            key.blips.splice(b, 1);
                            --b;
                        }
                    }else
                    {
                        if (blip.time > timeBlipEnd) {
                            this.ctx.fillStyle = "#f2f842";
                            this.ctx.globalAlpha = alpha - ((now - blip.time) / 1000);
                            this.ctx.fillRect(x, 3, w, this.test_whiteKeyHeight - 6);
                        } else {
                            key.blips.splice(b, 1);
                            --b;
                        }
                    }

                     y -= Math.floor(h * 1.1);
                }
            }
        }
    }
    this.ctx.restore();
};

Test_CanvasRenderer.prototype.getTestHit = function (x, y) {
    for (var j = 0; j < 2; j++) {
        var sharp = j ? false : true; // black keys first
        for (var i in this.test_piano.keys) {
            if (!this.test_piano.keys.hasOwnProperty(i)) continue;
            var key = this.test_piano.keys[i];
            if (key.sharp != sharp) continue;
            if (key.rect.contains(x, y)) {
                var v = y / (key.sharp ? this.test_blackKeyHeight : this.test_whiteKeyHeight);
                v += 0.25;
                v *= DEFAULT_VELOCITY;
                if (v > 1.0) v = 1.0;
                return {"key": key, "v": v};
            }
        }
    }
    return null;
};


Test_CanvasRenderer.isSupported = function () {
    var canvas = document.createElement("canvas");
    return !!(canvas.getContext && canvas.getContext("2d"));
};

Test_CanvasRenderer.translateMouseEvent = function (evt) {
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

var Test_PianoKey = function (note, octave) {
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

var Test_Piano = function (rootElement) {

    var test_piano = this;
    test_piano.rootElement = rootElement;
    test_piano.keys = {};

    var white_spatial = 0;
    var black_spatial = 0;
    var black_it = 0;
    var black_lut = [2, 1, 2, 1, 1];
    var addKey = function (note, octave, nVal) {
        var key = new Test_PianoKey(note, octave);
        test_piano.keys[key.note] = key;
        test_piano.keys[key.note].selected = nVal;
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
        for (var i in test_piano.keys) {
            test_piano.keys[i].selected = arrSelect[nIndex];

            nIndex ++;
        }
    }else
    {

    }

    this.test_renderer = new Test_CanvasRenderer().init(this);

    window.AudioContext = window.AudioContext || window.webkitAudioContext || undefined;
    var audio_engine = Test_AudioEngineWeb;

    this.audio = new audio_engine().init(function () {

        for (var i in test_piano.keys) {
            if (!test_piano.keys.hasOwnProperty(i)) continue;
            (function () {
                var key = test_piano.keys[i];
                test_piano.audio.load(key.note, gSoundPath + key.note + gSoundExt, function () {
                    key.loaded = true;
                    key.timeLoaded = Date.now();
                    if (key.domElement) // todo: move this to renderer somehow
                        $(key.domElement).removeClass("loading");
                });
            })();
        }

        test_piano.audio.effectLoad("x0", gSoundPath + "x0" + gSoundExt, function () {});

        test_piano.audio.effectLoad("y0", gSoundPath + "y0" + gSoundExt, function () {});
    });
};

Test_Piano.prototype.play = function (note, vol, participant, delay_ms) {

    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];

    if (key.loaded) this.audio.play(key.note, vol, delay_ms, participant.id);

    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, vol * 100, delay_ms);
    var self = this;
    var jq_namediv = $(typeof participant == "undefined" ? null : participant.nameDiv);
    if (jq_namediv) {
        setTimeout(function () {

            // Zhang 2018.3.13 --- no need
            //self.test_renderer.visualize(key, typeof participant == "undefined" ? "yellow" : "#777");
            jq_namediv.addClass("play");
            setTimeout(function () {
                jq_namediv.removeClass("play");
            }, 30);
        }, delay_ms);
    }
};

Test_Piano.prototype.stop = function (note, participant, delay_ms) {
    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];
    if (key.loaded) this.audio.stop(key.note, delay_ms, participant.id);
    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, 0, delay_ms);
};

var gTest_Piano = new Test_Piano(document.getElementById("test-piano"));

var gAutoSustain = false;
var gSustain = false;

var gHeldNotes = {};
var gSustainedNotes = {};
var resultNotification;
function test_press(id, vol) {

    var key = gTest_Piano.keys[id];
    if(key.selected == 0)
    {
        return;
    }

    if(bNoteFromFile || bRandom)
    {
        return;
    }

    if(bTestMe_Start == true)
    {
        for (var ids in gSustainedNotes) {
            if (gSustainedNotes.hasOwnProperty(ids) && gSustainedNotes[ids] && !gHeldNotes[ids]) {
                gSustainedNotes[ids] = false;

            }
        }
        if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {
            gHeldNotes[id] = true;
            gSustainedNotes[id] = false;
            gSustainedNotes[id] = true;
            gTest_Piano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);

            setTimeout(function(){
                if (gNoteQuota.spend(1)) {
                    gTest_Piano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                    gSustainedNotes[id] = false;
                }
            }, 200);
        }
    }

    setTimeout(function(){
        processCorrectIncorrectResult(id, vol);
    }, 50);

}

// play sound when click keyboard in test me mode -- added by Zhang  2018.3.27//
function processCorrectIncorrectResult(id, vol) {

    var key = gTest_Piano.keys[id];
    if(key.selected == 0)
    {
        return;
    }

    if(bNoteFromFile || bRandom)
    {
        return;
    }

    if(bTestMe_Start == true)
    {
        if(bAutoRinged == false)
            return;

        if(perClickCount == 0)
        {
            Total_Tested ++;
        }

        perClickCount ++;

        userRingNote = id;
        bUserInputed = true;

        $("#total_tested").html(Total_Tested);

        /********************************************** added by zhang ***/

        var cIdx = 0;

        for(var i in gTest_Piano.keys)
        {
            if(i === id)
            {
                break;
            }
            cIdx ++;
        }
        if(!arrClickcntPerKeyboard[cIdx]) arrClickcntPerKeyboard[cIdx] = 0
        arrClickcntPerKeyboard[cIdx] =  arrClickcntPerKeyboard[cIdx] + 1;
        /********************************************** added by Zhang ***/

        if(userRingNote === autoRingNote)
        {
            bAutoRinged = false;


            if(perClickCount == 1)
            {
                Total_Correct++;

                $("#total_correct").html(Total_Correct);

                $("#correct_percentage").html(Math.floor(Number.parseFloat(Total_Correct/Total_Tested).toFixed(2)*10000)/100 + " %");
            }



            var now = Date.now();

            var totalSeconds = (now - firstTime) / 1000;

            hours = Math.floor(totalSeconds / 3600);

            if(hours < 10)
            {
                hours = "0" + hours;
            }

            totalSeconds %= 3600;
            minutes = Math.floor(totalSeconds / 60);

            if(minutes < 10)
            {
                minutes = "0" + minutes;
            }
            seconds = Math.floor(totalSeconds % 60);

            if(seconds < 10)
            {
                seconds = "0" + seconds;
            }

            var nIndex = 0;

            for(var i in gTest_Piano.keys)
            {
                if(i === id)
                {
                    break;
                }

                nIndex ++;
            }

            //Math.floor((Number.parseFloat(1 / perClickCount).toFixed(2) * 100) * 100)/100
            arrCorrect[nIndex] = Math.floor((Number.parseFloat(1 / perClickCount).toFixed(2) * 100) * 100)/100 + " %";
            arrTime[nIndex] = hours + ":" + minutes + ":" + seconds;

            // added for click
            if(!arrCorrectPerKeyboard[nIndex]) arrCorrectPerKeyboard[nIndex] = 0
            arrCorrectPerKeyboard[nIndex] =  arrCorrectPerKeyboard[nIndex] + 1;

            //clearInterval(timeTracker);

            $.toast({
                heading: 'Notice',
                text: 'You Got it! Popup (with audio, as many as admin adds) for CORRECT!',
                position: 'top-center',
                stack: false
            })

            $("#dialog-test-result").dialog('close');
            //$("div[aria-describedby='test-confirm']").addClass('disableddialog');
            //$('#dialog-test-result-correct').dialog("open");

            // commented by Zhang Zhe-- play it always as mp3
            //gTest_Piano.audio.actualEffectPlay("x0", DEFAULT_VELOCITY, 10, gClient.getOwnParticipant());
            //new Audio(gSoundPath + "x0" + gSoundExt).play();

            // correctAudio.muted = false;
            // correctAudio.play();

            var source = this.correctSoundContext.createBufferSource();
            source.buffer = correctBuff;
            var mediaStreamDest = this.correctSoundContext.createMediaStreamDestination();
            source.connect(mediaStreamDest);
            var audioEl = new Audio();
            audioEl.src = URL.createObjectURL(mediaStreamDest.stream);
            audioEl.play();
            source.start(0);

        }else
        {
            // $.toast({
            //     heading: 'Notice',
            //     text: 'Nope, try again (with audio, variations as many as admin adds) for INCORRECT!',
            //     position: 'top-center',
            //     stack: false
            // })


            $('#dialog-test-result').dialog("open");
            $("div[aria-describedby='test-confirm']").addClass('disableddialog');

            // commented by Zhang Zhe-- play it always as mp3
            //gTest_Piano.audio.actualEffectPlay("y0", DEFAULT_VELOCITY, 10, gClient.getOwnParticipant());
            //new Audio(gSoundPath + "y0" + gSoundExt).play();

            // incorrectAudio.muted = false;
            // incorrectAudio.play();

            var source = this.incorrectSoundContext.createBufferSource();
            source.buffer = wrongBuff;
            var mediaStreamDest = this.incorrectSoundContext.createMediaStreamDestination();
            source.connect(mediaStreamDest);
            var audioEl = new Audio();
            audioEl.src = URL.createObjectURL(mediaStreamDest.stream);
            audioEl.play();
            source.start(0);

            $("#total_correct").html(Total_Correct);

            $("#correct_percentage").html(Math.floor((Number.parseFloat(Total_Correct/Total_Tested).toFixed(2) * 100) * 100)/100  + " %");

            return;
        }
    }

    if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {

        gHeldNotes[id] = true;
        gSustainedNotes[id] = true;
        //gTest_Piano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);

        if(bTestMe_Start == true)
        {
            setTimeout(function(){
                ringRandomKey();
            }, 1000); // it was 1000 .. changed for quik input. user can input keyboard after 300ms from here
        }
    }
}
// play sound when click keyboard in test me mode //

function test_custom_press(id, vol) {

    var key = gTest_Piano.keys[id];
    if(key.selected == 0)
    {
        return;
    }

    if(bNoteFromFile || bRandom)
    {
        return;
    }

    if(bTestMe_Start == true)
    {
        for (var ids in gSustainedNotes) {
                if (gSustainedNotes.hasOwnProperty(ids) && gSustainedNotes[ids] && !gHeldNotes[ids]) {
                    gSustainedNotes[ids] = false;
                    
                }
            }
        if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {
            gHeldNotes[id] = true;
            gSustainedNotes[id] = false;
            gSustainedNotes[id] = true;
            gTest_Piano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);

            setTimeout(function(){
                if (gNoteQuota.spend(1)) {
                    gTest_Piano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                    gSustainedNotes[id] = false;
                }
            }, 180);
        }
    }
}

function test_effectPlay(id, vol)
{
    

    if(bNoteFromFile || bRandom)
    {
        return;
    }

    if(bTestMe_Start == true)
    {
        if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {
            gHeldNotes[id] = true;
            gSustainedNotes[id] = true;
            gTest_Piano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);

            setTimeout(function(){
                if (gNoteQuota.spend(1)) {
                    gTest_Piano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                    gSustainedNotes[id] = false;
                }
            }, 300);
        }
    }
}
volume_slider.set(gTest_Piano.audio.volume);
function test_release(id) {
    if (gHeldNotes[id]) {
        gHeldNotes[id] = false;
        if ((gAutoSustain || gSustain) && !enableSynth) {
            gSustainedNotes[id] = true;
        } else {
            if (gNoteQuota.spend(1)) {
                gTest_Piano.stop(id, gClient.getOwnParticipant(), 0);
                gClient.stopNote(id);
                gSustainedNotes[id] = false;
            }
        }
    }
}


function test_releaseSustain() {
    gSustain = false;
    if (!gAutoSustain) {
        for (var id in gSustainedNotes) {
            if (gSustainedNotes.hasOwnProperty(id) && gSustainedNotes[id] && !gHeldNotes[id]) {
                gSustainedNotes[id] = false;
                if (gNoteQuota.spend(1)) {
                    gTest_Piano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                }
            }
        }
    }
}


// internet science

////////////////////////////////////////////////////////////////
function test_handleKeyDown(evt) {
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
            test_press(note, vol);
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

function test_handleKeyUp(evt) {
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
            test_release(note);
        }

        evt.preventDefault();
        evt.stopPropagation();
        return false;
    } else if (code == 20) { // Caps Lock
        capsLockKey = false;
        evt.preventDefault();
    } else if (code === 0x20) { // Space Bar
        test_releaseSustain();
        evt.preventDefault();
    }
};

function test_handleKeyPress(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.keyCode == 27 || evt.keyCode == 13) {
        //$("#chat input").focus();
    }
    return false;
};

var test_recapListener = function (evt) {
    captureKeyboard();
};

function test_captureKeyboard() {
    $("#pianos").off("mousedown", test_recapListener);
    $("#pianos").off("touchstart", test_recapListener);
    $(document).on("keydown", test_handleKeyDown);
    $(document).on("keyup", test_handleKeyUp);
    $(window).on("keypress", test_handleKeyPress);
};

function test_releaseKeyboard() {
    $(document).off("keydown", test_handleKeyDown);
    $(document).off("keyup", test_handleKeyUp);
    $(window).off("keypress", test_handleKeyPress);
    $("#pianos").on("mousedown", test_recapListener);
    $("#pianos").on("touchstart", test_recapListener);
};

test_captureKeyboard();

// API
window.MPP = {
    press: test_press,
    release: test_release,
    test_piano: gTest_Piano,
    client: gClient,
    chat: chat,
    noteQuota: gNoteQuota
};


