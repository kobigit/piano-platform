


// AudioEngine classes

////////////////////////////////////////////////////////////////

function Worker() {
    self.onmessage = function (event) {
        setTimeout(function () {
            postMessage({args: event.data.args});
        }, event.data.delay);
    }
}

AudioEngineWeb = function () {
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

AudioEngineWeb.prototype = new AudioEngine();

AudioEngineWeb.prototype.init = function (cb) {
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

    // set contextMain
    contextMain = this.context;
    return this;
};

AudioEngineWeb.prototype.load = function (id, url, cb) {
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

AudioEngineWeb.prototype.actualPlay = function (id, vol, time, part_id) { //the old play(), but with time insted of delay_ms.
    if (!this.sounds.hasOwnProperty(id)) return;

    if(false == canplayMidi()){
        var mp3Audio = new Audio(this.soundsUrl[id]);
        mp3Audio.volume = vol;
        mp3Audio.play();

        setTimeout(function(){
            mp3Audio.muted = true;
        }, 300);
    } else {

        if(MIDI_COMPUTER_SOUND_ON_OFF == 'on'){

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
        } else {

            // navigator.mediaDevices.enumerateDevices()
            //     .then(function(deviceInfos) {
            //
            //         for (var i = 0; i !== deviceInfos.length; ++i) {
            //             var deviceInfo = deviceInfos[i];
            //             if(deviceInfo.kind=='audiooutput') {
            //                 console.log('***** audio devices *****', deviceInfo);
            //             }
            //         }
            //
            //     })

            // //var tempContext = new AudioContext({ sinkId: '490eb7734a517fb0c2cd2e4f59023fb44be92da2e7be374c0510141b3f7beea8' });
            // var tempContext = new AudioContext({ sinkId: '490eb7734a517fb0c2cd2e4f59023fb44be92da2e7be374c0510141b3f7beea8' });
            // var source = tempContext.createBufferSource();
            // source.buffer = this.sounds[id];
            // var mediaStreamDest = tempContext.createMediaStreamDestination();
            // source.connect(mediaStreamDest);
            // var audioEl = new Audio();
            // audioEl.src = URL.createObjectURL(mediaStreamDest.stream);
            // //audioEl.setSinkId(this.audioDevices[0].deviceId);
            // audioEl.play();
            // source.start(time);

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

    }

}

AudioEngineWeb.prototype.play = function (id, vol, delay_ms, part_id) {
    if (!this.sounds.hasOwnProperty(id)) return;
    var time = this.context.currentTime + (delay_ms / 1000); //calculate time on note receive.
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualPlay(id, vol, time, part_id);
    else {
        // this.worker.postMessage({delay: delay, args: {action: 0/*play*/, id: id, vol: vol, time: time, part_id: part_id}}); // but start scheduling right before play.
    }
}

AudioEngineWeb.prototype.actualStop = function (id, time, part_id) {
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

AudioEngineWeb.prototype.stop = function (id, delay_ms, part_id) {
    var time = this.context.currentTime + (delay_ms / 1000);
    var delay = delay_ms - this.threshold;
    if (delay <= 0) this.actualStop(id, time, part_id);
    else {
        // this.worker.postMessage({delay: delay, args: {action: 1/*stop*/, id: id, time: time, part_id: part_id}});
    }
};

AudioEngineWeb.prototype.setVolume = function (vol) {
    AudioEngine.prototype.setVolume.call(this, vol);
    this.masterGain.gain.value = this.volume;
};


// VolumeSlider inst

////////////////////////////////////////////////////////////////




// Renderer classes

////////////////////////////////////////////////////////////////

var Renderer = function () {
};

Renderer.prototype.init = function (piano) {
    this.piano = piano;
    this.resize();
    return this;
};

Renderer.prototype.resize = function (width, height) {
    if (typeof width == "undefined") width = $(this.piano.rootElement).width();
    if (typeof height == "undefined") height = Math.floor(width * 0.2);

    //height =700; 
    //width = 800;
    // alert("width----"+width);
    $(this.piano.rootElement).css({"height": height + "px", marginTop: Math.floor($(window).height() / 2 - height / 2) + "px"});
    this.width = width;
    this.height = height;
};

Renderer.prototype.visualize = function (key, color) {
};


var CanvasRenderer = function () {
    Renderer.call(this);
};

CanvasRenderer.prototype = new Renderer();

CanvasRenderer.prototype.init = function (piano) {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    piano.rootElement.appendChild(this.canvas);

    Renderer.prototype.init.call(this, piano); // calls resize()

    // create render loop
    var self = this;
    var render = function () {
        self.redraw();
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // add event listeners
    var mouse_down = false;
    var last_key = null;
    $(piano.rootElement).mousedown(function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();

        var pos = CanvasRenderer.translateMouseEvent(event);
        var hit = self.getHit(pos.x, pos.y);
        if (hit) {
            press(hit.key.note, hit.v);
            last_key = hit.key;
        }

        $(piano.rootElement).on('mousemove', function (event) {
            event.preventDefault();

            var pos = CanvasRenderer.translateMouseEvent(event);
            var hit = self.getHit(pos.x, pos.y);

            if (hit) {
                press(hit.key.note, hit.v);
                last_key = hit.key;
            }
        });

    });

    $(document).on('mouseup', function (event) {
        $(piano.rootElement).off('mousemove');
    });

    piano.rootElement.addEventListener("touchstart", function (event) {
        mouse_down = true;
        //event.stopPropagation();
        event.preventDefault();
        for (var i in event.changedTouches) {
            var pos = CanvasRenderer.translateMouseEvent(event.changedTouches[i]);
            var hit = self.getHit(pos.x, pos.y);
            if (hit) {
                press(hit.key.note, hit.v);
                last_key = hit.key;
            }
        }
    }, false);
    $(window).mouseup(function (event) {
        if (last_key) {
            release(last_key.note);
        }
        mouse_down = false;
        last_key = null;
    });
    /*$(piano.rootElement).mousemove(function(event) {
     if(!mouse_down) return;
     var pos = CanvasRenderer.translateMouseEvent(event);
     var hit = self.getHit(pos.x, pos.y);
     if(hit && hit.key != last_key) {
     press(hit.key.note, hit.v);
     last_key = hit.key;
     }
     });*/

    return this;
};

CanvasRenderer.prototype.resize = function (width, height) {
    Renderer.prototype.resize.call(this, width, height);
    if (this.width < 52 * 2) this.width = 52 * 2;
    if (this.height < this.width * 0.2) this.height = Math.floor(this.width * 0.2);
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // calculate key sizes
    this.whiteKeyWidth = Math.floor((this.width / 52) * 1000)/1000;
    this.whiteKeyHeight = Math.floor(this.height * 0.98);
    this.blackKeyWidth = Math.floor(this.whiteKeyWidth * 0.63);
    this.blackKeyHeight = Math.floor(this.height * 0.58);

    this.blackKeyOffset = Math.floor(this.whiteKeyWidth - (this.blackKeyWidth / 2));
    this.keyMovement = Math.floor(this.whiteKeyHeight * 0.015);

    this.whiteBlipWidth = Math.floor(this.whiteKeyWidth * 0.7);
    this.whiteBlipHeight = Math.floor(this.whiteBlipWidth * 0.8);
    this.whiteBlipX = Math.floor((this.whiteKeyWidth - this.whiteBlipWidth) / 2);
    this.whiteBlipY = Math.floor(this.whiteKeyHeight - this.whiteBlipHeight * 1.2);
    this.blackBlipWidth = Math.floor(this.blackKeyWidth * 0.7);
    this.blackBlipHeight = Math.floor(this.blackBlipWidth * 0.8);
    this.blackBlipY = Math.floor(this.blackKeyHeight - this.blackBlipHeight * 1.2);
    this.blackBlipX = Math.floor((this.blackKeyWidth - this.blackBlipWidth) / 2);

    // prerender white key
    this.whiteKeyRender = document.createElement("canvas");
    this.whiteKeyRender.width = this.whiteKeyWidth;
    this.whiteKeyRender.height = this.height + 10;
    var ctx = this.whiteKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.whiteKeyHeight);
        gradient.addColorStop(0, "#fff");
        gradient.addColorStop(0.75, "#fff");
        gradient.addColorStop(1, "#fff");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#fff";
    }

    var imgKeyObj = document.getElementById("img_key_normal");
    ctx.drawImage(imgKeyObj, ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);

    // ctx.strokeStyle = "#000";
    // ctx.lineJoin = "round";
    // ctx.lineCap = "round";
    // ctx.lineWidth = 10;
    // ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
    // ctx.lineWidth = 1;
    // ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);

    // prerender white key
    this.whiteYellowKeyRender = document.createElement("canvas");
    this.whiteYellowKeyRender.width = this.whiteKeyWidth;
    this.whiteYellowKeyRender.height = this.height + 10;
    var ctx = this.whiteYellowKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.whiteKeyHeight);
        gradient.addColorStop(0, "#72a5de");
        gradient.addColorStop(0.75, "#72a5de");
        gradient.addColorStop(1, "#72a5de");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#72a5de";
    }

    imgKeyObj = document.getElementById("img_key_normal_blue");
    ctx.drawImage(imgKeyObj, ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);

    // ctx.strokeStyle = "#000";
    // ctx.lineJoin = "round";
    // ctx.lineCap = "round";
    // ctx.lineWidth = 10;
    // ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
    // ctx.lineWidth = 1;
    // ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);

    // prerender black key
    this.blackKeyRender = document.createElement("canvas");
    this.blackKeyRender.width = this.blackKeyWidth + 10;
    this.blackKeyRender.height = this.blackKeyHeight + 10;
    var ctx = this.blackKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.blackKeyHeight);
        gradient.addColorStop(0, "#000");
        gradient.addColorStop(1, "#000");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#000";
    }

    imgKeyObj = document.getElementById("img_black");
    ctx.drawImage(imgKeyObj, ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

    //ctx.drawImage(img, ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

    // ctx.strokeStyle = "#222";
    // ctx.lineJoin = "round";
    // ctx.lineCap = "round";
    // ctx.lineWidth = 8;
    // ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);
    // ctx.lineWidth = 4;
    // ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

    // prerender black key
    this.blackYellowKeyRender = document.createElement("canvas");
    this.blackYellowKeyRender.width = this.blackKeyWidth + 10;
    this.blackYellowKeyRender.height = this.blackKeyHeight + 10;
    var ctx = this.blackYellowKeyRender.getContext("2d");
    if (ctx.createLinearGradient) {
        var gradient = ctx.createLinearGradient(0, 0, 0, this.blackKeyHeight);
        gradient.addColorStop(0, "#72a5de");
        gradient.addColorStop(1, "#72a5de");
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = "#72a5de";
    }

    var imgBlueSmall = document.getElementById("img_blue");
    ctx.drawImage(imgBlueSmall, ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

    // ctx.strokeStyle = "#3b699b";
    // ctx.lineJoin = "round";
    // ctx.lineCap = "round";
    // ctx.lineWidth = 8;
    // ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);
    // ctx.lineWidth = 1;
    // ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

    // prerender shadows
    this.shadowRender = [];
    var y = -this.canvas.height * 2;
    for (var j = 0; j < 2; j++) {
        var canvas = document.createElement("canvas");
        this.shadowRender[j] = canvas;
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        var ctx = canvas.getContext("2d");
        var sharp = j ? true : false;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        //ctx.shadowBlur = this.keyMovement * 0.1;
        ctx.shadowOffsetY = -y + this.keyMovement * 0.75;
        if (sharp) {
            ctx.shadowOffsetX = this.keyMovement;
        } else {
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = -y + this.keyMovement;
        }
        for (var i in this.piano.keys) {
            if (!this.piano.keys.hasOwnProperty(i)) continue;
            var key = this.piano.keys[i];
            if (key.sharp != sharp) continue;

            // if (key.sharp) {
            //     ctx.fillRect(this.blackKeyOffset + this.whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
            //         y + ctx.lineWidth / 2,
            //         this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);
            // } else {
            //     ctx.fillRect(this.whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
            //         y + ctx.lineWidth / 2,
            //         this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
            // }

            var imgBlueSmallShadow = document.getElementById("img_key_small_shadow");
            ctx.drawImage(imgBlueSmallShadow, this.whiteKeyWidth + this.whiteKeyWidth * key.spatial + ctx.lineWidth / 2 ,
                y + ctx.lineWidth / 2,
                this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight);
                // ctx.font = "30px Arial";
                // ctx.fillStyle="white"
                // ctx.fillText("A", 0, this.blackKeyHeight+110);
        }
    }

    // update key rects
    for (var i in this.piano.keys) {
        if (!this.piano.keys.hasOwnProperty(i)) continue;
        var key = this.piano.keys[i];
        if (key.sharp) {
            key.rect = new Rect(this.blackKeyOffset + this.whiteKeyWidth * key.spatial, 0,
                this.blackKeyWidth, this.blackKeyHeight);
        } else {
            key.rect = new Rect(this.whiteKeyWidth * key.spatial, 0,
                this.whiteKeyWidth, this.whiteKeyHeight);
        }
    }
};

CanvasRenderer.prototype.visualize = function (key, color) {
    key.timePlayed = Date.now();
    // remove play background effect when click keyboard  4.24 jeni
    //key.blips.push({"time": key.timePlayed, "color": color});
};

CanvasRenderer.prototype.redraw = function () {
    var now = Date.now();
    var timeLoadedEnd = now - 1000;
    var timePlayedEnd = now - 100;
    var timeBlipEnd = now - 1000;

    var arrSelect = JSON.parse(localStorage.getItem("arrSelect"));

    if(arrSelect !== 'undefined' && arrSelect != null)
    {
        var nIndex = 0;
        for (var i in this.piano.keys) {

            if(bNoteFromFile)
            {
                this.piano.keys[i].selected = 1;
            }else
            {
                this.piano.keys[i].selected = arrSelect[nIndex];
            }

            nIndex ++;
        }
    }else
    {
        if(bNoteFromFile)
        {
            for (var i in this.piano.keys) {

                this.piano.keys[i].selected = 1;
            }
        }else
        {
            for (var i in this.piano.keys) {

                this.piano.keys[i].selected = 0;
            }
        }
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // draw all keys
    for (var j = 0; j < 2; j++) {
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.shadowRender[j], 0, 0);
        var sharp = j ? true : false;
        for (var i in this.piano.keys) {
            if (!this.piano.keys.hasOwnProperty(i)) continue;
            var key = this.piano.keys[i];
            if (key.sharp != sharp) continue;

            if (!key.loaded || key.selected == 0) {
                //this.ctx.globalAlpha = 0.2;
                this.ctx.globalAlpha = ((now - key.timeLoaded) / 1000) * 0.8 + 0.2;
            } else if (key.timeLoaded > timeLoadedEnd) {
                this.ctx.globalAlpha = ((now - key.timeLoaded) / 1000) * 0.8 + 0.2;
            } else {
                this.ctx.globalAlpha = 1.0;
            }
            var y = 0;
            if (key.timePlayed > timePlayedEnd) {
                y = Math.floor(this.keyMovement - (((now - key.timePlayed) / 100) * this.keyMovement));
            }
            var x = Math.floor(key.sharp ? this.blackKeyOffset + this.whiteKeyWidth * key.spatial
                : this.whiteKeyWidth * key.spatial);

            var image = null;

            if(key.sharp)
            {
                if(key.selected == 0)
                {
                    image =  this.blackKeyRender;
                }else
                {
                    image =  this.blackYellowKeyRender;
                }
            }else
            {
                if(key.selected == 0)
                {
                    image =  this.whiteKeyRender;
                }else
                {
                    image =  this.whiteYellowKeyRender;
                }
            }

            this.ctx.drawImage(image, x, y);

            // render blips
            if (key.blips.length) {
                var alpha = this.ctx.globalAlpha;
                var w, h;
                if (key.sharp) {
                    x += this.blackBlipX;

                    y = this.blackBlipY;
                    w = this.blackBlipWidth;
                    h = this.blackBlipHeight;
                } else {
                    x += this.whiteBlipX;

                    y = this.whiteBlipY;
                    w = this.whiteBlipWidth;
                    h = this.whiteBlipHeight;
                }
                for (var b = 0; b < key.blips.length; b++) {
                    var blip = key.blips[b];

                    if(key.sharp)
                    {
                        if (blip.time > timeBlipEnd) {
                            this.ctx.fillStyle = "#72a5de";
                            this.ctx.globalAlpha = alpha - ((now - blip.time) / 1000);
                            this.ctx.fillRect(x, 3, w, this.blackKeyHeight - 6);
                        } else {
                            key.blips.splice(b, 1);
                            --b;
                        }
                    }else
                    {
                        if (blip.time > timeBlipEnd) {
                            this.ctx.fillStyle = "#72a5de";
                            this.ctx.globalAlpha = alpha - ((now - blip.time) / 1000);
                            this.ctx.fillRect(x, 3, w, this.whiteKeyHeight - 6);
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

CanvasRenderer.prototype.getHit = function (x, y) {
    for (var j = 0; j < 2; j++) {
        var sharp = j ? false : true; // black keys first
        for (var i in this.piano.keys) {
            if (!this.piano.keys.hasOwnProperty(i)) continue;
            var key = this.piano.keys[i];
            if (key.sharp != sharp) continue;
            if (key.rect.contains(x, y)) {
                var v = y / (key.sharp ? this.blackKeyHeight : this.whiteKeyHeight);
                v += 0.25;
                v *= DEFAULT_VELOCITY;
                if (v > 1.0) v = 1.0;
                return {"key": key, "v": v};
            }
        }
    }
    return null;
};


CanvasRenderer.isSupported = function () {
    var canvas = document.createElement("canvas");
    return !!(canvas.getContext && canvas.getContext("2d"));
};

CanvasRenderer.translateMouseEvent = function (evt) {
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


function update_availableKey()
{

}
// Pianoctor

////////////////////////////////////////////////////////////////

var PianoKey = function (note, octave) {
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

var Piano = function (rootElement) {

    var piano = this;
    piano.rootElement = rootElement;
    piano.keys = {};

    var white_spatial = 0;
    var black_spatial = 0;
    var black_it = 0;
    var black_lut = [2, 1, 2, 1, 1];
    var addKey = function (note, octave) {
        var key = new PianoKey(note, octave);
        piano.keys[key.note] = key;
        if (key.sharp) {
            key.spatial = black_spatial;
            black_spatial += black_lut[black_it % 5];
            ++black_it;
        } else {
            key.spatial = white_spatial;
            ++white_spatial;
        }
    }
    if (test_mode) {
        addKey("c", 2);
    } else {
        addKey("a", -1);
        addKey("as", -1);
        addKey("b", -1);
        var notes = "c cs d ds e f fs g gs a as b".split(" ");
        for (var oct = 0; oct < 7; oct++) {
            for (var i in notes) {
                addKey(notes[i], oct);
            }
        }
        addKey("c", 7);
    }

    var arrSelect = JSON.parse(localStorage.getItem("arrSelect"));

    if(arrSelect !== 'undefined' && arrSelect != null)
    {
        var nIndex = 0;
        for (var i in piano.keys) {
            piano.keys[i].selected = arrSelect[nIndex];

            nIndex ++;
        }
    }else
    {

    }

    this.renderer = new CanvasRenderer().init(this);

    window.addEventListener("resize", function () {
        piano.renderer.resize();
    });


    window.AudioContext = window.AudioContext || window.webkitAudioContext || undefined;
    var audio_engine = AudioEngineWeb;

    this.audio = new audio_engine().init(function () {
        for (var i in piano.keys) {
            if (!piano.keys.hasOwnProperty(i)) continue;
            (function () {
                var key = piano.keys[i];
                piano.audio.load(key.note, gSoundPath + key.note + gSoundExt, function () {
                    key.loaded = true;
                    key.timeLoaded = Date.now();
                    if (key.domElement) // todo: move this to renderer somehow
                        $(key.domElement).removeClass("loading");
                });
            })();
        }
    });
};

Piano.prototype.play = function (note, vol, participant, delay_ms) {
    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];

    if (key.loaded) this.audio.play(key.note, vol, delay_ms, participant.id);

    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, vol * 100, delay_ms);
    var self = this;
    var jq_namediv = $(typeof participant == "undefined" ? null : participant.nameDiv);
    if (jq_namediv) {
        setTimeout(function () {
            self.renderer.visualize(key, typeof participant == "undefined" ? "yellow" : "#777");
            jq_namediv.addClass("play");
            setTimeout(function () {
                jq_namediv.removeClass("play");
            }, 30);
        }, delay_ms);
    }
};

Piano.prototype.stop = function (note, participant, delay_ms) {
    if (!this.keys.hasOwnProperty(note)) return;
    var key = this.keys[note];
    if (key.loaded) this.audio.stop(key.note, delay_ms, participant.id);
    if (typeof gMidiOutTest === "function") gMidiOutTest(key.note, 0, delay_ms);
};

var gPiano = new Piano(document.getElementById("piano"));

var gAutoSustain = false;
var gSustain = false;

var gHeldNotes = {};
var gSustainedNotes = {};

function press(id, vol) {

    var key = gPiano.keys[id];
    if(key.selected == 0)
    {
        return;
    }

    if(bNoteFromFile)
    {
        return;
    }
    for (var ids in gSustainedNotes) {
        if (gSustainedNotes.hasOwnProperty(ids) && gSustainedNotes[ids] && !gHeldNotes[ids]) {
            gSustainedNotes[ids] = false;

        }
    }
    if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {

        gHeldNotes[id] = true;


        gSustainedNotes[id] = true;
        gPiano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);
        //gClient.startNote(id, vol);

        setTimeout(function(){
            if (gNoteQuota.spend(1)) {
                gPiano.stop(id, gClient.getOwnParticipant(), 0);
                gClient.stopNote(id);
                gSustainedNotes[id] = false;
            }
        }, 300);
    }
}

function custom_press(id, vol) {

    var key = gPiano.keys[id];
    if(key.selected == 0)
    {
        return;
    }

    for (var ids in gSustainedNotes) {
        if (gSustainedNotes.hasOwnProperty(ids) && gSustainedNotes[ids] && !gHeldNotes[ids]) {
            gSustainedNotes[ids] = false;
        }
    }
    if (!gClient.preventsPlaying() && gNoteQuota.spend(1)) {

        gHeldNotes[id] = true;

        gSustainedNotes[id] = true;
        gPiano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);

        setTimeout(function(){
            if (gNoteQuota.spend(1)) {
                gPiano.stop(id, gClient.getOwnParticipant(), 0);
                gClient.stopNote(id);
                gSustainedNotes[id] = false;
            }
        }, 300);
        //gClient.startNote(id, vol);
    }
}

function release(id) {
    if (gHeldNotes[id]) {
        gHeldNotes[id] = false;
        if ((gAutoSustain || gSustain) && !enableSynth) {
            gSustainedNotes[id] = true;
        } else {
            if (gNoteQuota.spend(1)) {
                gPiano.stop(id, gClient.getOwnParticipant(), 0);
                gClient.stopNote(id);
                gSustainedNotes[id] = false;
            }
        }
    }
}

function pressSustain() {
    gSustain = true;
}

function releaseSustain() {
    gSustain = false;
    if (!gAutoSustain) {
        for (var id in gSustainedNotes) {
            if (gSustainedNotes.hasOwnProperty(id) && gSustainedNotes[id] && !gHeldNotes[id]) {
                gSustainedNotes[id] = false;
                if (gNoteQuota.spend(1)) {
                    gPiano.stop(id, gClient.getOwnParticipant(), 0);
                    gClient.stopNote(id);
                }
            }
        }
    }
}
volume_slider.set(gPiano.audio.volume);
function handleKeyDown(evt) {
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
            press(note, vol);
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

function handleKeyUp(evt) {
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
            release(note);
        }

        evt.preventDefault();
        evt.stopPropagation();
        return false;
    } else if (code == 20) { // Caps Lock
        capsLockKey = false;
        evt.preventDefault();
    } else if (code === 0x20) { // Space Bar
        releaseSustain();
        evt.preventDefault();
    }
};

function handleKeyPress(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.keyCode == 27 || evt.keyCode == 13) {
        //$("#chat input").focus();
    }
    return false;
};

var recapListener = function (evt) {
    captureKeyboard();
};

function captureKeyboard()
{

    $(document).off("keydown", handleKeyDown);
    $(document).off("keyup", handleKeyUp);
    $(window).off("keypress", handleKeyPress);

    $("#piano").off("mousedown", recapListener);
    $("#piano").off("touchstart", recapListener);
    $("#pianos").off("mousedown", dialog_recapListener);
    $("#pianos").off("touchstart", dialog_recapListener);
    $("#test-piano").off("mousedown", test_recapListener);
    $("#test-piano").off("touchstart", test_recapListener);

    $(document).off("keydown", dialog_handleKeyDown);
    $(document).off("keyup", dialog_handleKeyUp);
    $(window).off("keypress", dialog_handleKeyPress);

    $(document).off("keydown", test_handleKeyDown);
    $(document).off("keyup", test_handleKeyUp);
    $(window).off("keypress", test_handleKeyPress);

    if(bShowDialog == true)
    {
        $(document).on("keydown", dialog_handleKeyDown);
        $(document).on("keyup", dialog_handleKeyUp);
        $(window).on("keypress", dialog_handleKeyPress);
    }else
    {
        if(bTestMe)
        {
            $(document).on("keydown",   test_handleKeyDown);
            $(document).on("keyup",     test_handleKeyUp);
            $(window).on("keypress",    test_handleKeyPress);
        }else
        {
            $(document).on("keydown", handleKeyDown);
            $(document).on("keyup", handleKeyUp);
            $(window).on("keypress", handleKeyPress);
        }
    }
};

function releaseKeyboard() {
    $(document).off("keydown", handleKeyDown);
    $(document).off("keyup", handleKeyUp);
    $(window).off("keypress", handleKeyPress);

    $("#piano").on("mousedown", recapListener);
    $("#piano").on("touchstart", recapListener);
};

captureKeyboard();




if (window.localStorage) {

    if (localStorage.volume) {
        volume_slider.set(localStorage.volume);
        gPiano.audio.setVolume(localStorage.volume);
    }
    else localStorage.volume = gPiano.audio.volume;

    window.gHasBeenHereBefore = (localStorage.gHasBeenHereBefore || false);
    if (gHasBeenHereBefore) {
    }
    localStorage.gHasBeenHereBefore = true;
}


// New room, change room

////////////////////////////////////////////////////////////////

$("#room > .info").text("--");
gClient.on("ch", function (msg) {
    var channel = msg.ch;
    var info = $("#room > .info");
    info.text(channel._id);
    if (channel.settings.lobby) info.addClass("lobby");
    else info.removeClass("lobby");
    if (!channel.settings.chat) info.addClass("no-chat");
    else info.removeClass("no-chat");
    if (channel.settings.crownsolo) info.addClass("crownsolo");
    else info.removeClass("crownsolo");
    if (!channel.settings.visible) info.addClass("not-visible");
    else info.removeClass("not-visible");
});
gClient.on("ls", function (ls) {
    for (var i in ls.u) {
        if (!ls.u.hasOwnProperty(i)) continue;
        var room = ls.u[i];
        var info = $("#room .info[roomname=\"" + (room._id + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0') + "\"]");
        if (info.length == 0) {
            info = $("<div class=\"info\"></div>");
            info.attr("roomname", room._id);
            $("#room .more").append(info);
        }
        info.text(room._id + " (" + room.count + ")");
        if (room.settings.lobby) info.addClass("lobby");
        else info.removeClass("lobby");
        if (!room.settings.chat) info.addClass("no-chat");
        else info.removeClass("no-chat");
        if (room.settings.crownsolo) info.addClass("crownsolo");
        else info.removeClass("crownsolo");
        if (!room.settings.visible) info.addClass("not-visible");
        else info.removeClass("not-visible");
        if (room.banned) info.addClass("banned");
        else info.removeClass("banned");
    }
});
$("#room").on("click", function (evt) {
    evt.stopPropagation();

    // clicks on a new room
    if ($(evt.target).hasClass("info") && $(evt.target).parents(".more").length) {
        $("#room .more").fadeOut(250);
        var selected_name = $(evt.target).attr("roomname");
        if (typeof selected_name != "undefined") {
            changeRoom(selected_name, "right");
        }
        return false;
    }
    // clicks on "New Room..."
    else if ($(evt.target).hasClass("new")) {
        openModal("#new-room", "input[name=name]");
    }
    // all other clicks
    var doc_click = function (evt) {
        if ($(evt.target).is("#room .more")) return;
        $(document).off("mousedown", doc_click);
        $("#room .more").fadeOut(250);
        gClient.sendArray([{m: "-ls"}]);
    }
    $(document).on("mousedown", doc_click);
    $("#room .more .info").remove();
    $("#room .more").show();
    gClient.sendArray([{m: "+ls"}]);
});
$("#new-room-btn").on("click", function (evt) {
    evt.stopPropagation();
    openModal("#new-room", "input[name=name]");
});


$("#play-alone-btn").on("click", function (evt) {
    evt.stopPropagation();
    var room_name = "Room" + Math.floor(Math.random() * 1000000000000);
    changeRoom(room_name, "right", {"visible": false, "chat": true, "crownsolo": false});

});


var gModal;

function modalHandleEsc(evt) {
    if (evt.keyCode == 27) {
        closeModal();
        evt.preventDefault();
        evt.stopPropagation();
    }
};

function openModal(selector, focus) {
    chat.blur();
    releaseKeyboard();
    $(document).on("keydown", modalHandleEsc);
    $("#modal #modals > *").hide();
    $("#modal").fadeIn(250);
    $(selector).show();
    setTimeout(function () {
        $(selector).find(focus).focus();
    }, 100);
    gModal = selector;
};

function closeModal() {
    $(document).off("keydown", modalHandleEsc);
    $("#modal").fadeOut(100);
    $("#modal #modals > *").hide();
    captureKeyboard();
    gModal = null;
};

var modal_bg = $("#modal .bg")[0];
$(modal_bg).on("click", function (evt) {
    if (evt.target != modal_bg) return;
    closeModal();
});

(function () {
    function submit() {
        var name = $("#new-room .text[name=name]").val();
        var settings = {
            visible: $("#new-room .checkbox[name=visible]").is(":checked"),
            chat: true,
            crownsolo: false
        };
        $("#new-room .text[name=name]").val("");
        closeModal();
        changeRoom(name, "right", settings);

    };
    $("#new-room .submit").click(function (evt) {
        submit();
    });
    $("#new-room .text[name=name]").keypress(function (evt) {
        if (evt.keyCode == 13) {
            submit();
        } else if (evt.keyCode == 27) {
            closeModal();
        } else {
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });
})();


function changeRoom(name, direction, settings, push) {
    if (!settings) settings = {};
    if (!direction) direction = "right";
    if (typeof push == "undefined") push = true;
    var opposite = direction == "left" ? "right" : "left";

    if (name == "") name = "lobby";
    if (gClient.channel && gClient.channel._id === name) return;
    if (push) {
        var url = "/" + encodeURIComponent(name).replace("'", "%27");
        if (window.history && history.pushState) {
            history.pushState({"depth": gHistoryDepth += 1, "name": name}, "Piano > " + name, url);
        } else {
            window.location = url;
            return;
        }
    }

    gClient.setChannel(name, settings);

    var t = 0, d = 100;
    $("#piano").addClass("ease-out").addClass("slide-" + opposite);
    setTimeout(function () {
        $("#piano").removeClass("ease-out").removeClass("slide-" + opposite).addClass("slide-" + direction);
    }, t += d);
    setTimeout(function () {
        $("#piano").addClass("ease-in").removeClass("slide-" + direction);
    }, t += d);
    setTimeout(function () {
        $("#piano").removeClass("ease-in");
    }, t += d);
};

var gHistoryDepth = 0;
$(window).on("popstate", function (evt) {
    var depth = evt.state ? evt.state.depth : 0;
    if (depth == gHistoryDepth) return; // <-- forgot why I did that though...

    var direction = depth <= gHistoryDepth ? "left" : "right";
    gHistoryDepth = depth;

    var name = decodeURIComponent(window.location.pathname);
    if (name.substr(0, 1) == "/") name = name.substr(1);
    changeRoom(name, direction, null, false);
});


// Rename

////////////////////////////////////////////////////////////////

(function () {
    function submit() {
        var set = {
            name: $("#rename input[name=name]").val(),
            color: $("#rename input[name=color]").val()
        };
        //$("#rename .text[name=name]").val("");
        closeModal();
        gClient.sendArray([{m: "userset", set: set}]);
    };
    $("#rename .submit").click(function (evt) {
        submit();
    });
    $("#rename .text[name=name]").keypress(function (evt) {
        if (evt.keyCode == 13) {
            submit();
        } else if (evt.keyCode == 27) {
            closeModal();
        } else {
            return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });
})();


// chatctor

////////////////////////////////////////////////////////////////

var chat = (function () {
    gClient.on("ch", function (msg) {
        if (msg.ch.settings.chat) {
            chat.show();
        } else {
            chat.hide();
        }
    });
    gClient.on("disconnect", function (msg) {
        chat.hide();
    });
    gClient.on("c", function (msg) {
        chat.clear();
        if (msg.c) {
            for (var i = 0; i < msg.c.length; i++) {
                chat.receive(msg.c[i]);
            }
        }
    });
    gClient.on("a", function (msg) {
        chat.receive(msg);
    });

    $("#chat input").on("focus", function (evt) {
        releaseKeyboard();
        $("#chat").addClass("chatting");
        chat.scrollToBottom();
    });

    $(document).mousedown(function (evt) {
        if (!$("#chat").has(evt.target).length > 0) {
            chat.blur();
        }
    });
    document.addEventListener("touchstart", function (event) {
        for (var i in event.changedTouches) {
            var touch = event.changedTouches[i];
            if (!$("#chat").has(touch.target).length > 0) {
                chat.blur();
            }
        }
    });
    $(document).on("keydown", function (evt) {
        if ($("#chat").hasClass("chatting")) {
            if (evt.keyCode == 27) {
                chat.blur();
                evt.preventDefault();
                evt.stopPropagation();
            } else if (evt.keyCode == 13) {
                $("#chat input").focus();
            }
        } else if (!gModal && (evt.keyCode == 27 || evt.keyCode == 13)) {
            $("#chat input").focus();
        }
    });
    $("#chat input").on("keydown", function (evt) {
        if (evt.keyCode == 13) {
            var message = $(this).val();
            if (message.length == 0) {
                setTimeout(function () {
                    chat.blur();
                }, 100);
            } else if (message.length <= 512) {
                chat.send(message);
                $(this).val("");
                setTimeout(function () {
                    chat.blur();
                }, 100);
            }
            evt.preventDefault();
            evt.stopPropagation();
        } else if (evt.keyCode == 27) {
            chat.blur();
            evt.preventDefault();
            evt.stopPropagation();
        } else if (evt.keyCode == 9) {
            evt.preventDefault();
            evt.stopPropagation();
        }
    });

    return {
        show: function () {
            $("#chat").fadeIn();
        },

        hide: function () {
            $("#chat").fadeOut();
        },

        clear: function () {
            $("#chat li").remove();
        },

        scrollToBottom: function () {
            var ele = $("#chat ul").get(0);
            ele.scrollTop = ele.scrollHeight;
        },

        blur: function () {
            if ($("#chat").hasClass("chatting")) {
                $("#chat input").get(0).blur();
                $("#chat").removeClass("chatting");
                chat.scrollToBottom();
                captureKeyboard();
            }
        },

        send: function (message) {
            gClient.sendArray([{m: "a", message: message}]);
        },

        receive: function (msg) {
            if (gChatMutes.indexOf(msg.p._id) != -1) return;

            var li = $('<li><span class="name"/><span class="message"/>');

            li.find(".name").text(msg.p.name + ":");
            li.find(".message").text(msg.a);
            li.css("color", msg.p.color || "white");

            $("#chat ul").append(li);

            var eles = $("#chat ul li").get();
            for (var i = 1; i <= 50 && i <= eles.length; i++) {
                eles[eles.length - i].style.opacity = 1.0 - (i * 0.03);
            }
            if (eles.length > 50) {
                eles[0].style.display = "none";
            }
            if (eles.length > 256) {
                $(eles[0]).remove();
            }

            // scroll to bottom if not "chatting" or if not scrolled up
            if (!$("#chat").hasClass("chatting")) {
                chat.scrollToBottom();
            } else {
                var ele = $("#chat ul").get(0);
                if (ele.scrollTop > ele.scrollHeight - ele.offsetHeight - 50)
                    chat.scrollToBottom();
            }
        }
    };
})();


// MIDI

////////////////////////////////////////////////////////////////

var MIDI_TRANSPOSE = -12;
var MIDI_KEY_NAMES = ["a-1", "as-1", "b-1"];
var bare_notes = "c cs d ds e f fs g gs a as b".split(" ");
for (var oct = 0; oct < 7; oct++) {
    for (var i in bare_notes) {
        MIDI_KEY_NAMES.push(bare_notes[i] + oct);
    }
}
MIDI_KEY_NAMES.push("c7");

var MIDI_LIST;

(function () {

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(
            function (midi) {
                console.log(midi);

                MIDI_LIST = midi;

                function midimessagehandler(evt) {

                    if (!evt.target.enabled) return;

                    //console.log(evt);
                    var channel = evt.data[0] & 0xf;
                    var cmd = evt.data[0] >> 4;
                    var note_number = evt.data[1];
                    var vel = evt.data[2];
                    console.log(channel, cmd, note_number, vel);
                    if (cmd == 8 || (cmd == 9 && vel == 0)) {
                        // NOTE_OFF

                        if(bTestMe)
                        {
                            test_release(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE]);

                            return;
                        }

                        if(bShowDialog)
                        {
                            dialog_release(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE]);

                            return;
                        }

                        release(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE]);
                    } else if (cmd == 9) {
                        // NOTE_ON

                        if(bTestMe)
                        {
                            test_press(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE], vel / 100);

                            return;
                        }

                        if(bShowDialog)
                        {
                            dialog_press(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE], vel / 100);

                            return;
                        }

                        press(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE], vel / 100);
                    } else if (cmd == 11) {
                        // CONTROL_CHANGE
                        if (!gAutoSustain) {
                            if (note_number == 64) {
                                if (vel > 0) {
                                    pressSustain();
                                } else {

                                    if(bTestMe)
                                    {
                                        test_releaseSustain();

                                        return;
                                    }

                                    if(bShowDialog)
                                    {
                                        dialog_releaseSustain();

                                        return;
                                    }

                                    releaseSustain();
                                }
                            }
                        }
                    }
                }

                function plug() {

                    if (midi.inputs.size > 0) {
                        var inputs = midi.inputs.values();
                        for (var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
                            var input = input_it.value;

                            input.onmidimessage = midimessagehandler;
                            if (input.enabled !== false) {
                                input.enabled = true;
                            }
                            console.log("input", input);
                        }
                    }
                    if (midi.outputs.size > 0) {
                        var outputs = midi.outputs.values();
                        for (var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
                            var output = output_it.value;
                            //output.enabled = false; // edit: don't touch
                            output.enabled = true; // edit: zhang
                            console.log("output", output);
                        }
                        gMidiOutTest = function (note_name, vel, delay_ms) {

                            var note_number = MIDI_KEY_NAMES.indexOf(note_name);
                            if (note_number == -1) return;
                            note_number = note_number + 9 - MIDI_TRANSPOSE;

                            var outputs = midi.outputs.values();
                            for (var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
                                var output = output_it.value;
                                if (output.enabled) {
                                    output.send([0x90, note_number, vel], window.performance.now() + delay_ms);
                                }
                            }
                        }
                    }
                    showConnections(false);
                }

                midi.addEventListener("statechange", function (evt) {
                    if (evt instanceof MIDIConnectionEvent) {
                        plug();
                    }
                });

                plug();


                var connectionsNotification;

                function showConnections(sticky) {
                    var inputs_ul = document.createElement("ul");
                    if (midi.inputs.size > 0) {
                        var inputs = midi.inputs.values();
                        for (var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
                            var input = input_it.value;
                            var li = document.createElement("li");
                            li.connectionId = input.id;
                            li.classList.add("connection");
                            if (input.enabled) li.classList.add("enabled");
                            li.textContent = input.name;
                            li.addEventListener("click", function (evt) {
                                var inputs = midi.inputs.values();
                                for (var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
                                    var input = input_it.value;
                                    if (input.id === evt.target.connectionId) {
                                        input.enabled = !input.enabled;
                                        evt.target.classList.toggle("enabled");
                                        console.log("click", input);
                                        return;
                                    }
                                }
                            });
                            inputs_ul.appendChild(li);
                        }
                    } else {
                        inputs_ul.textContent = "(none)";
                    }
                    var outputs_ul = document.createElement("ul");
                    if (midi.outputs.size > 0) {
                        var outputs = midi.outputs.values();
                        for (var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
                            var output = output_it.value;
                            var li = document.createElement("li");
                            li.connectionId = output.id;
                            li.classList.add("connection");
                            if (output.enabled) li.classList.add("enabled");
                            li.textContent = output.name;
                            li.addEventListener("click", function (evt) {
                                var outputs = midi.outputs.values();
                                for (var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
                                    var output = output_it.value;
                                    if (output.id === evt.target.connectionId) {
                                        output.enabled = !output.enabled;
                                        evt.target.classList.toggle("enabled");
                                        console.log("click", output);
                                        return;
                                    }
                                }
                            });
                            outputs_ul.appendChild(li);
                        }
                    } else {
                        outputs_ul.textContent = "(none)";
                    }
                    var div = document.createElement("div");
                    var h1 = document.createElement("h1");
                    h1.textContent = "Inputs";
                    div.appendChild(h1);
                    div.appendChild(inputs_ul);
                    h1 = document.createElement("h1");
                    h1.textContent = "Outputs";
                    div.appendChild(h1);
                    div.appendChild(outputs_ul);
                    connectionsNotification = new Notification({"id": "MIDI-Connections", "title": "MIDI Connections", "duration": sticky ? "-1" : "4500", "html": div, "target": "#midi-btn"});
                }

                document.getElementById("midi-btn").addEventListener("click", function (evt) {
                    if (!document.getElementById("Notification-MIDI-Connections"))
                        showConnections(true);
                    else {
                        connectionsNotification.close();
                    }
                });
            },
            function (err) {
                console.log(err);
            });
    }
})();


// bug supply

////////////////////////////////////////////////////////////////




// API
window.MPP = {
    press: press,
    release: release,
    piano: gPiano,
    client: gClient,
    chat: chat,
    noteQuota: gNoteQuota
};


// record mp3
(function () {
    var button = document.querySelector("#record-btn");
    var audio = MPP.piano.audio;
    var context = audio.context;
    var encoder_sample_rate = 44100;
    var encoder_kbps = 128;
    var encoder = null;
    var scriptProcessorNode = context.createScriptProcessor(4096, 2, 2);
    var recording = false;
    var recording_start_time = 0;
    var mp3_buffer = [];
    button.addEventListener("click", function (evt) {
        if (!recording) {
            // start recording
            mp3_buffer = [];
            encoder = new lamejs.Mp3Encoder(2, encoder_sample_rate, encoder_kbps);
            scriptProcessorNode.onaudioprocess = onAudioProcess;
            audio.masterGain.connect(scriptProcessorNode);
            scriptProcessorNode.connect(context.destination);
            recording_start_time = Date.now();
            recording = true;
            button.textContent = "Stop Recording";
            button.classList.add("stuck");
            new Notification({
                "id": "mp3",
                "title": "Recording MP3...",
                "html": "It's recording now.  This could make things slow, maybe.  Maybe give it a moment to settle before playing.<br>.",
                "duration": 10000
            });
        } else {
            // stop recording
            var mp3buf = encoder.flush();
            mp3_buffer.push(mp3buf);
            var blob = new Blob(mp3_buffer, {type: "audio/mp3"});
            var url = URL.createObjectURL(blob);
            scriptProcessorNode.onaudioprocess = null;
            audio.masterGain.disconnect(scriptProcessorNode);
            scriptProcessorNode.disconnect(context.destination);
            recording = false;
            button.textContent = "Record MP3";
            button.classList.remove("stuck");
            new Notification({
                "id": "mp3",
                "title": "MP3 recording finished",
                "html": "<a href=\"" + url + "\" target=\"blank\">And here it is!</a> (open or save as)<br><br>This feature is experimental.",
                "duration": 0
            });
        }
    });

    function onAudioProcess(evt) {
        var inputL = evt.inputBuffer.getChannelData(0);
        var inputR = evt.inputBuffer.getChannelData(1);
        var mp3buf = encoder.encodeBuffer(convert16(inputL), convert16(inputR));
        mp3_buffer.push(mp3buf);
    }

    function convert16(samples) {
        var len = samples.length;
        var result = new Int16Array(len);
        for (var i = 0; i < len; i++) {
            result[i] = 0x8000 * samples[i];
        }
        return (result);
    }
})();
var audio = gPiano.audio;
var context = gPiano.audio.context;
var synth_gain = context.createGain();
synth_gain.gain.value = 0.05;
synth_gain.connect(audio.synthGain);

function synthVoice(note_name, time) {
    var note_number = MIDI_KEY_NAMES.indexOf(note_name);
    note_number = note_number + 9 - MIDI_TRANSPOSE;
    var freq = Math.pow(2, (note_number - 69) / 12) * 440.0;
    this.osc = context.createOscillator();
    this.osc.type = osc1_type;
    this.osc.frequency.value = freq;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.osc.connect(this.gain);
    this.gain.connect(synth_gain);
    this.osc.start(time);
    this.gain.gain.setValueAtTime(0, time);
    this.gain.gain.linearRampToValueAtTime(1, time + osc1_attack);
    this.gain.gain.linearRampToValueAtTime(osc1_sustain, time + osc1_attack + osc1_decay);
}

synthVoice.prototype.stop = function (time) {
    //this.gain.gain.setValueAtTime(osc1_sustain, time);
    this.gain.gain.linearRampToValueAtTime(0, time + osc1_release);
    this.osc.stop(time + osc1_release);
};

(function () {
    var button = document.getElementById("synth-btn");
    var notification;

    button.addEventListener("click", function () {
        if (notification) {
            notification.close();
        } else {
            showSynth();
        }
    });

    function showSynth() {

        var html = document.createElement("div");

        // on/off button
        (function () {
            var button = document.createElement("input");
            mixin(button, {type: "button", value: "ON/OFF.html", className: enableSynth ? "switched-on" : "switched-off"});
            button.addEventListener("click", function (evt) {
                enableSynth = !enableSynth;
                button.className = enableSynth ? "switched-on" : "switched-off";
                if (!enableSynth) {
                    // stop all
                    for (var i in audio.playings) {
                        if (!audio.playings.hasOwnProperty(i)) continue;
                        var playing = audio.playings[i];
                        if (playing && playing.voice) {
                            playing.voice.osc.stop();
                            playing.voice = undefined;
                        }
                    }
                }
            });
            html.appendChild(button);
        })();

        // mix
        var knob = document.createElement("canvas");
        mixin(knob, {width: 32, height: 32, className: "knob"});
        html.appendChild(knob);
        knob = new Knob(knob, 0, 100, 0.1, 50, "mix", "%");
        knob.on("change", function (k) {
            var mix = k.value / 100;
            audio.pianoGain.gain.value = 1 - mix;
            audio.synthGain.gain.value = mix;
        });
        knob.emit("change", knob);

        // osc1 type
        (function () {
            osc1_type = osc_types[osc_type_index];
            var button = document.createElement("input");
            mixin(button, {type: "button", value: osc_types[osc_type_index]});
            button.addEventListener("click", function (evt) {
                if (++osc_type_index >= osc_types.length) osc_type_index = 0;
                osc1_type = osc_types[osc_type_index];
                button.value = osc1_type;
            });
            html.appendChild(button);
        })();

        // osc1 attack
        var knob = document.createElement("canvas");
        mixin(knob, {width: 32, height: 32, className: "knob"});
        html.appendChild(knob);
        knob = new Knob(knob, 0, 1, 0.001, osc1_attack, "osc1 attack", "s");
        knob.on("change", function (k) {
            osc1_attack = k.value;
        });
        knob.emit("change", knob);

        // osc1 decay
        var knob = document.createElement("canvas");
        mixin(knob, {width: 32, height: 32, className: "knob"});
        html.appendChild(knob);
        knob = new Knob(knob, 0, 2, 0.001, osc1_decay, "osc1 decay", "s");
        knob.on("change", function (k) {
            osc1_decay = k.value;
        });
        knob.emit("change", knob);

        var knob = document.createElement("canvas");
        mixin(knob, {width: 32, height: 32, className: "knob"});
        html.appendChild(knob);
        knob = new Knob(knob, 0, 1, 0.001, osc1_sustain, "osc1 sustain", "x");
        knob.on("change", function (k) {
            osc1_sustain = k.value;
        });
        knob.emit("change", knob);

        // osc1 release
        var knob = document.createElement("canvas");
        mixin(knob, {width: 32, height: 32, className: "knob"});
        html.appendChild(knob);
        knob = new Knob(knob, 0, 2, 0.001, osc1_release, "osc1 release", "s");
        knob.on("change", function (k) {
            osc1_release = k.value;
        });
        knob.emit("change", knob);


        var div = document.createElement("div");
        div.innerHTML = "<br><br><br><br><center>this space intentionally left blank</center><br><br><br><br>";
        html.appendChild(div);


        // notification
        notification = new Notification({title: "Synthesize", html: html, duration: -1, target: "#synth-btn"});
        notification.on("close", function () {
            var tip = document.getElementById("tooltip");
            if (tip) tip.parentNode.removeChild(tip);
            notification = null;
        });
    }
})();

function playSet() {
    $.each(['A3', 'A4', 'B-1', 'Gs4', 'C5'], function (i, v) {
        var note = v.toLowerCase();
        var delay = (i * 1000) > 2000 ? 1000 : i * 1000;
        if (gPiano.keys.hasOwnProperty(note)) {
            gPiano.play(note, DEFAULT_VELOCITY, gClient.getOwnParticipant(), delay);
        }
    });
    return true;
}

// });


// misc

////////////////////////////////////////////////////////////////

// analytics
window.google_analytics_uacct = "UA-882009-7";
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-882009-7']);
_gaq.push(['_trackPageview']);
_gaq.push(['_setAllowAnchor', true]);
(function () {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
})();
