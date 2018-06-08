// 钢琴

// $(function () {

var test_mode = (window.location.hash && window.location.hash.match(/^(?:#.+)*#test(?:#.+)*$/i));

var gSeeOwnCursor = (window.location.hash && window.location.hash.match(/^(?:#.+)*#seeowncursor(?:#.+)*$/i));

var gMidiOutTest = (window.location.hash && window.location.hash.match(/^(?:#.+)*#midiout(?:#.+)*$/i)); // todo this is no longer needed

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (elt /*, from*/) {
        var len = this.length >>> 0;
        var from = Number(arguments[1]) || 0;
        from = (from < 0) ? Math.ceil(from) : Math.floor(from);
        if (from < 0) from += len;
        for (; from < len; from++) {
            if (from in this && this[from] === elt) return from;
        }
        return -1;
    };
}

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame
    || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
    || function (cb) {
        setTimeout(cb, 1000 / 30);
    };


var gSoundPath = "/mp3/";
var gSoundExt = ".wav.mp3";

// Yoshify.
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#Piano_Great_and_Soft(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/216104606/GreatAndSoftPiano/";
    gSoundExt = ".mp3";
}

if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#Piano_Loud_and_Proud(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/216104606/LoudAndProudPiano/";
    gSoundExt = ".mp3";
}

// electrashave
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#NewPiano(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/258840068/CustomSounds/NewPiano/";
    gSoundExt = ".mp3";
}

// Ethan Walsh
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#HDPiano(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/258840068/CustomSounds/HDPiano/";
    gSoundExt = ".wav";
}
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#Harpischord(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/24213061/Harpischord/";
    gSoundExt = ".wav";
}
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#ClearPiano(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/24213061/ClearPiano/";
    gSoundExt = ".wav";
}

// Alexander Holmfjeld
if ((window.location.hash && window.location.hash.match(/^(?:#.+)*#Klaver(?:#.+)*$/i))) {
    gSoundPath = "https://dl.dropboxusercontent.com/u/70730519/Klaver/";
    gSoundExt = ".wav";
}


var DEFAULT_VELOCITY = 0.5;


var TIMING_TARGET = 1000;


// Utility

////////////////////////////////////////////////////////////////


var Rect = function (x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.x2 = x + w;
    this.y2 = y + h;
};
Rect.prototype.contains = function (x, y) {
    return (x >= this.x && x <= this.x2 && y >= this.y && y <= this.y2);
};


// performing translation

////////////////////////////////////////////////////////////////

var Translation = (function () {
    var strings = {
        "people are playing": {
            "pt": "pessoas estão jogando",
            "es": "personas están jugando",
            "ru": "человек играет",
            "fr": "personnes jouent",
            "ja": "人が遊んでいる",
            "de": "Leute spielen",
            "zh": "人在玩",
            "nl": "mensen spelen",
            "pl": "osób grają",
            "hu": "ember játszik"
        },
        "New Room...": {
            "pt": "Nova Sala ...",
            "es": "Nueva sala de...",
            "ru": "Новый номер...",
            "ja": "新しい部屋",
            "zh": "新房间",
            "nl": "nieuwe Kamer",
            "hu": "új szoba"
        },
        "room name": {
            "pt": "nome da sala",
            "es": "sala de nombre",
            "ru": "название комнаты",
            "fr": "nom de la chambre",
            "ja": "ルーム名",
            "de": "Raumnamen",
            "zh": "房间名称",
            "nl": "kamernaam",
            "pl": "nazwa pokój",
            "hu": "szoba neve"
        },
        "Visible (open to everyone)": {
            "pt": "Visível (aberto a todos)",
            "es": "Visible (abierto a todo el mundo)",
            "ru": "Visible (открытый для всех)",
            "fr": "Visible (ouvert à tous)",
            "ja": "目に見える（誰にでも開いている）",
            "de": "Sichtbar (offen für alle)",
            "zh": "可见（向所有人开放）",
            "nl": "Zichtbaar (open voor iedereen)",
            "pl": "Widoczne (otwarte dla wszystkich)",
            "hu": "Látható (nyitott mindenki számára)"
        },
        "Enable Chat": {
            "pt": "Ativar bate-papo",
            "es": "Habilitar chat",
            "ru": "Включить чат",
            "fr": "Activer discuter",
            "ja": "チャットを有効にする",
            "de": "aktivieren Sie chatten",
            "zh": "启用聊天",
            "nl": "Chat inschakelen",
            "pl": "Włącz czat",
            "hu": "a csevegést"
        },
        "Play Alone": {
            "pt": "Jogar Sozinho",
            "es": "Jugar Solo",
            "ru": "Играть в одиночку",
            "fr": "Jouez Seul",
            "ja": "一人でプレイ",
            "de": "Alleine Spielen",
            "zh": "独自玩耍",
            "nl": "Speel Alleen",
            "pl": "Zagraj sam",
            "hu": "Játssz egyedül"
        }
        // todo: it, tr, th, sv, ar, fi, nb, da, sv, he, cs, ko, ro, vi, id, nb, el, sk, bg, lt, sl, hr
        // todo: Connecting, Offline mode, input placeholder, Notifications
    };

    var setLanguage = function (lang) {
        language = lang
    };

    var getLanguage = function () {
        if (window.navigator && navigator.language && navigator.language.length >= 2) {
            return navigator.language.substr(0, 2).toLowerCase();
        } else {
            return "en";
        }
    };

    var get = function (text, lang) {
        if (typeof lang === "undefined") lang = language;
        var row = strings[text];
        if (row == undefined) return text;
        var string = row[lang];
        if (string == undefined) return text;
        return string;
    };

    var perform = function (lang) {
        if (typeof lang === "undefined") lang = language;
        $(".translate").each(function (i, ele) {
            var th = $(this);
            if (ele.tagName && ele.tagName.toLowerCase() == "input") {
                if (typeof ele.placeholder != "undefined") {
                    th.attr("placeholder", get(th.attr("placeholder"), lang))
                }
            } else {
                th.text(get(th.text(), lang));
            }
        });
    };

    var language = getLanguage();

    return {
        setLanguage: setLanguage,
        getLanguage: getLanguage,
        get: get,
        perform: perform
    };
})();

Translation.perform();

var AudioEngine = function () {
};

AudioEngine.prototype.init = function (cb) {
    this.volume = 0.6;
    this.sounds = {};
    this.soundsUrl = {}; // added by ZHang for save mp3 URL
    return this;
};

AudioEngine.prototype.load = function (id, url, cb) {
};

AudioEngine.prototype.play = function () {
};

AudioEngine.prototype.stop = function () {
};

AudioEngine.prototype.setVolume = function (vol) {
    this.volume = vol;
};

var channel_id = decodeURIComponent(window.location.pathname);
if (channel_id.substr(0, 1) == "/") channel_id = channel_id.substr(1);
if (channel_id == "") channel_id = "lobby";

var wssport = window.location.hostname == "www.sqpiano.com.html" ? 443 : 8080;
var gClient = new Client("ws://" + window.location.hostname + ":" + wssport);
gClient.setChannel(channel_id);
gClient.start();


// Setting status


// Handle changes to participants
(function () {
    gClient.on("participant added", function (part) {

        part.displayX = 150;
        part.displayY = 50;

        // add nameDiv
        var div = document.createElement("div");
        div.className = "name";
        div.participantId = part.id;
        div.textContent = part.name || "";
        div.style.backgroundColor = part.color || "#777";
        if (gClient.participantId === part.id) {
            $(div).addClass("me");
        }
        if (gClient.channel && gClient.channel.crown && gClient.channel.crown.participantId === part.id) {
            $(div).addClass("owner");
        }
        if (gPianoMutes.indexOf(part._id) !== -1) {
            $(part.nameDiv).addClass("muted-notes");
        }
        if (gChatMutes.indexOf(part._id) !== -1) {
            $(part.nameDiv).addClass("muted-chat");
        }
        div.style.display = "none";
        part.nameDiv = $("#names")[0].appendChild(div);
        $(part.nameDiv).fadeIn(2000);

        // sort names
        var arr = $("#names .name");
        arr.sort(function (a, b) {
            a = a.style.backgroundColor; // todo: sort based on user id instead
            b = b.style.backgroundColor;
            if (a > b) return 1;
            else if (a < b) return -1;
            else return 0;
        });
        $("#names").html(arr);

        // add cursorDiv
        if (gClient.participantId !== part.id || gSeeOwnCursor) {
            var div = document.createElement("div");
            div.className = "cursor";
            div.style.display = "none";
            part.cursorDiv = $("#cursors")[0].appendChild(div);
            $(part.cursorDiv).fadeIn(2000);

            var div = document.createElement("div");
            div.className = "name";
            div.style.backgroundColor = part.color || "#777"
            div.textContent = part.name || "";
            part.cursorDiv.appendChild(div);

        } else {
            part.cursorDiv = undefined;
        }
    });
    gClient.on("participant removed", function (part) {
        // remove nameDiv
        var nd = $(part.nameDiv);
        var cd = $(part.cursorDiv);
        cd.fadeOut(2000);
        nd.fadeOut(2000, function () {
            nd.remove();
            cd.remove();
            part.nameDiv = undefined;
            part.cursorDiv = undefined;
        });
    });
    gClient.on("participant update", function (part) {
        var name = part.name || "";
        var color = part.color || "#777";
        part.nameDiv.style.backgroundColor = color;
        part.nameDiv.textContent = name;
        $(part.cursorDiv)
            .find(".name")
            .text(name)
            .css("background-color", color);
    });
    gClient.on("ch", function (msg) {
        for (var id in gClient.ppl) {
            if (gClient.ppl.hasOwnProperty(id)) {
                var part = gClient.ppl[id];
                if (part.id === gClient.participantId) {
                    $(part.nameDiv).addClass("me");
                } else {
                    $(part.nameDiv).removeClass("me");
                }
                if (msg.ch.crown && msg.ch.crown.participantId === part.id) {
                    $(part.nameDiv).addClass("owner");
                    $(part.cursorDiv).addClass("owner");
                } else {
                    $(part.nameDiv).removeClass("owner");
                    $(part.cursorDiv).removeClass("owner");
                }
                if (gPianoMutes.indexOf(part._id) !== -1) {
                    $(part.nameDiv).addClass("muted-notes");
                } else {
                    $(part.nameDiv).removeClass("muted-notes");
                }
                if (gChatMutes.indexOf(part._id) !== -1) {
                    $(part.nameDiv).addClass("muted-chat");
                } else {
                    $(part.nameDiv).removeClass("muted-chat");
                }
            }
        }
    });

    function updateCursor(msg) {
        const part = gClient.ppl[msg.id];
        if (part && part.cursorDiv) {
            part.cursorDiv.style.left = msg.x + "%";
            part.cursorDiv.style.top = msg.y + "%";
        }
    }

    gClient.on("m", updateCursor);
    gClient.on("participant added", updateCursor);
})();


// Handle changes to crown
(function () {
    var jqcrown = $('<div id="crown"></div>').appendTo(document.body).hide();
    var jqcountdown = $('<span></span>').appendTo(jqcrown);
    var countdown_interval;
    jqcrown.click(function () {
        gClient.sendArray([{m: "chown", id: gClient.participantId}]);
    });
    gClient.on("ch", function (msg) {
        if (msg.ch.crown) {
            var crown = msg.ch.crown;
            if (!crown.participantId || !gClient.ppl[crown.participantId]) {
                var land_time = crown.time + 2000 - gClient.serverTimeOffset;
                var avail_time = crown.time + 15000 - gClient.serverTimeOffset;
                jqcountdown.text("");
                jqcrown.show();
                if (land_time - Date.now() <= 0) {
                    jqcrown.css({"left": crown.endPos.x + "%", "top": crown.endPos.y + "%"});
                } else {
                    jqcrown.css({"left": crown.startPos.x + "%", "top": crown.startPos.y + "%"});
                    jqcrown.addClass("spin");
                    jqcrown.animate({"left": crown.endPos.x + "%", "top": crown.endPos.y + "%"}, 2000, "linear", function () {
                        jqcrown.removeClass("spin");
                    });
                }
                clearInterval(countdown_interval);
                countdown_interval = setInterval(function () {
                    var time = Date.now();
                    if (time >= land_time) {
                        var ms = avail_time - time;
                        if (ms > 0) {
                            jqcountdown.text(Math.ceil(ms / 1000) + "s");
                        } else {
                            jqcountdown.text("");
                            clearInterval(countdown_interval);
                        }
                    }
                }, 1000);
            } else {
                jqcrown.hide();
            }
        } else {
            jqcrown.hide();
        }
    });
    gClient.on("disconnect", function () {
        jqcrown.fadeOut(2000);
    });
})();


// Playing notes
/*gClient.on("n", function (msg) {
 var t = msg.t - gClient.serverTimeOffset + TIMING_TARGET - Date.now();
 var participant = gClient.findParticipantById(msg.p);
 if (gPianoMutes.indexOf(participant._id) !== -1)
 return;
 for (var i = 0; i < msg.n.length; i++) {
 var note = msg.n[i];
 var ms = t + (note.d || 0);
 if (ms < 0) {
 ms = 0;
 }
 else if (ms > 10000) continue;
 if (note.s) {
 gDialog_Piano.stop(note.n, participant, ms);
 } else {
 var vel = (typeof note.v !== "undefined") ? parseFloat(note.v) : DEFAULT_VELOCITY;
 if (vel < 0) vel = 0; else if (vel > 1) vel = 1;
 gDialog_Piano.play(note.n, vel, participant, ms);
 if (enableSynth) {
 gDialog_Piano.stop(note.n, participant, ms + 1000);
 }
 }
 }
 });*/

// Send cursor updates
var mx = 0, last_mx = -10, my = 0, last_my = -10;

$(document).mousemove(function (event) {
    mx = ((event.pageX / $(window).width()) * 100).toFixed(2);
    my = ((event.pageY / $(window).height()) * 100).toFixed(2);
});


// Room settings button
(function () {
    gClient.on("ch", function (msg) {
        if (gClient.isOwner()) {
            $("#room-settings-btn").show();
        } else {
            $("#room-settings-btn").hide();
        }
    });
    $("#room-settings-btn").click(function (evt) {
        if (gClient.channel && gClient.isOwner()) {
            var settings = gClient.channel.settings;
            openModal("#room-settings");
            setTimeout(function () {
                $("#room-settings .checkbox[name=visible]").prop("checked", settings.visible);
                $("#room-settings .checkbox[name=chat]").prop("checked", settings.chat);
                $("#room-settings .checkbox[name=crownsolo]").prop("checked", settings.crownsolo);
                $("#room-settings input[name=color]").val(settings.color);
            }, 100);
        }
    });
    $("#room-settings .submit").click(function () {
        var settings = {
            visible: $("#room-settings .checkbox[name=visible]").is(":checked"),
            chat: $("#room-settings .checkbox[name=chat]").is(":checked"),
            crownsolo: $("#room-settings .checkbox[name=crownsolo]").is(":checked"),
            color: $("#room-settings input[name=color]").val()
        };
        gClient.sendArray([{m: "chset", set: settings}]);
        closeModal();
    });
    $("#room-settings .drop-crown").click(function () {
        closeModal();
        if (confirm("This will drop the crown...!"))
            gClient.sendArray([{m: "chown"}]);
    });
})();

// Handle notifications
gClient.on("notification", function (msg) {
    new Notification(msg);
});

// Don't foget spin
gClient.on("ch", function (msg) {
    var chidlo = msg.ch._id.toLowerCase();
    if (chidlo === "spin" || chidlo.substr(-5) === "/spin") {
        $("#piano").addClass("spin");
    } else {
        $("#piano").removeClass("spin");
    }
});

/*function eb() {
 if(gClient.channel && gClient.channel._id.toLowerCase() === "test/fishing.html") {
 ebsprite.start(gClient);
 } else {
 ebsprite.stop();
 }
 }
 if(ebsprite) {
 gClient.on("ch", eb);
 eb();
 }*/

// Crownsolo notice
gClient.on("ch", function (msg) {
    if (msg.ch.settings.crownsolo) {
        if ($("#crownsolo-notice").length == 0) {
            $('<div id="crownsolo-notice">').text('This room is set to "only the owner can play."').appendTo("body").fadeIn(1000);
        }
    } else {
        $("#crownsolo-notice").remove();
    }
});
gClient.on("disconnect", function () {
    $("#crownsolo-notice").remove();
});


// Background color
(function () {
    var old_color1 = new Color("#71767b");
    var old_color2 = new Color("#929ba3");

    function setColor(hex) {
        var color1 = new Color(hex);
        var color2 = new Color(hex);
        color2.add(-0x40, -0x40, -0x40);

        var bottom = document.getElementById("bottom");

        var duration = 500;
        var step = 0;
        var steps = 30;
        var step_ms = duration / steps;
        var difference = new Color(color1.r, color1.g, color1.b);
        difference.r -= old_color1.r;
        difference.g -= old_color1.g;
        difference.b -= old_color1.b;
        var inc = new Color(difference.r / steps, difference.g / steps, difference.b / steps);
        var iv;
        iv = setInterval(function () {
            old_color1.add(inc.r, inc.g, inc.b);
            old_color2.add(inc.r, inc.g, inc.b);
            document.body.style.background = "radial-gradient(ellipse at center, " + old_color1.toHexa() + " 0%," + old_color2.toHexa() + " 100%)";
            bottom.style.background = old_color2.toHexa();
            if (++step >= steps) {
                clearInterval(iv);
                old_color1 = color1;
                old_color2 = color2;
                document.body.style.background = "radial-gradient(ellipse at center, " + color1.toHexa() + " 0%," + color2.toHexa() + " 100%)";
                bottom.style.background = color2.toHexa();
            }
        }, step_ms);
    }

    setColor("#929ba3");

    gClient.on("ch", function (ch) {
        if (ch.ch.settings) {
            if (ch.ch.settings.color) {
                setColor(ch.ch.settings.color);
            } else {
                setColor("#929ba3");
            }
        }
    });
})();


var gPianoMutes = [];

var gChatMutes = [];

var VolumeSlider = function (ele, cb) {
    // this.rootElement = ele;
    // this.cb = cb;
    // var range = document.createElement("input");
    // try {
    //     range.type = "range";
    // } catch (e) {
    //     // hello, IE9
    // }
    // if (range.min !== undefined) {
    //     this.range = range;
    //     this.rootElement.appendChild(range);
    //     range.className = "volume-slider";
    //     range.min = "0.0";
    //     range.max = "1.0";
    //     range.step = "0.01";
    //     $(range).on("change", function (evt) {
    //         cb(range.value);
    //     });
    // } else {
    //     if (window.console) console.log("warn: no slider");
    //     // todo
    // }

    this.cb = cb;
    var range = $('#slider-tick-volume').slider();
    this.range = range;
    $(range).on("change", function (evt) {
        console.log('*** start ***', evt.value.newValue/100);
        cb(evt.value.newValue/100);
    });
};

VolumeSlider.prototype.set = function (v) {
    if (this.range !== undefined) {
        this.range.slider('setValue', v, true);
        this.range.slider('refresh');
        //his.range.setValue(v);
    } else {
        // todo
    }
};
var volume_slider = new VolumeSlider(document.getElementById("volume"), function (v) {
    gPiano.audio.setVolume(v);
    gDialog_Piano.audio.setVolume(v);
    gTest_Piano.audio.setVolume(v);
    if (window.localStorage) localStorage.volume = v;
});


var Note = function (note, octave) {
    this.note = note;
    this.octave = octave || 0;
};


var n = function (a, b) {
    return {note: new Note(a, b), held: false};
};
var key_binding = {
    65: n("gs"),
    90: n("a"),
    83: n("as"),
    88: n("b"),
    67: n("c", 1),
    70: n("cs", 1),
    86: n("d", 1),
    71: n("ds", 1),
    66: n("e", 1),
    78: n("f", 1),
    74: n("fs", 1),
    77: n("g", 1),
    75: n("gs", 1),
    188: n("a", 1),
    76: n("as", 1),
    190: n("b", 1),
    191: n("c", 2),
    222: n("cs", 2),

    49: n("gs", 1),
    81: n("a", 1),
    50: n("as", 1),
    87: n("b", 1),
    69: n("c", 2),
    52: n("cs", 2),
    82: n("d", 2),
    53: n("ds", 2),
    84: n("e", 2),
    89: n("f", 2),
    55: n("fs", 2),
    85: n("g", 2),
    56: n("gs", 2),
    73: n("a", 2),
    57: n("as", 2),
    79: n("b", 2),
    80: n("c", 3),
    189: n("cs", 3),
    219: n("d", 3),
    187: n("ds", 3),
    221: n("e", 3)
};

var capsLockKey = false;

var transpose_octave = 0;

var velocityFromMouseY = function () {
    return 0.1 + (my / 100) * 0.6;
};

// NoteQuota
var gNoteQuota = (function () {
    var last_rat = 0;
    var nqjq = $("#quota .value");
    setInterval(function () {
        gNoteQuota.tick();
    }, 2000);
    return new NoteQuota(function (points) {
        // update UI
        var rat = (points / this.max) * 100;
        if (rat <= last_rat)
            nqjq.stop(true, true).css("width", rat.toFixed(0) + "%");
        else
            nqjq.stop(true, true).animate({"width": rat.toFixed(0) + "%"}, 2000, "linear");
        last_rat = rat;
    });
})();
gClient.on("nq", function (nq_params) {
    gNoteQuota.setParams(nq_params);
});
gClient.on("disconnect", function () {
    gNoteQuota.setParams(NoteQuota.PARAMS_OFFLINE);
});

// click participant names
(function () {
    var ele = document.getElementById("names");
    var touchhandler = function (e) {
        var target_jq = $(e.target);
        if (target_jq.hasClass("name")) {
            target_jq.addClass("play");
            if (e.target.participantId == gClient.participantId) {
                openModal("#rename", "input[name=name]");
                setTimeout(function () {
                    $("#rename input[name=name]").val(gClient.ppl[gClient.participantId].name);
                    $("#rename input[name=color]").val(gClient.ppl[gClient.participantId].color);
                }, 100);
            } else if (e.target.participantId) {
                var id = e.target.participantId;
                var part = gClient.ppl[id] || null;
                if (part) {
                    participantMenu(part);
                    e.stopPropagation();
                }
            }
        }
    };
    ele.addEventListener("mousedown", touchhandler);
    ele.addEventListener("touchstart", touchhandler);
    var releasehandler = function (e) {
        $("#names .name").removeClass("play");
    };
    document.body.addEventListener("mouseup", releasehandler);
    document.body.addEventListener("touchend", releasehandler);

    var removeParticipantMenus = function () {
        $(".participant-menu").remove();
        $(".participantSpotlight").hide();
        document.removeEventListener("mousedown", removeParticipantMenus);
        document.removeEventListener("touchstart", removeParticipantMenus);
    };

    var participantMenu = function (part) {
        if (!part) return;
        removeParticipantMenus();
        document.addEventListener("mousedown", removeParticipantMenus);
        document.addEventListener("touchstart", removeParticipantMenus);
        $("#" + part.id).find(".enemySpotlight").show();
        var menu = $('<div class="participant-menu"></div>');
        $("body").append(menu);
        // move menu to name position
        var jq_nd = $(part.nameDiv);
        var pos = jq_nd.position();
        menu.css({
            "top": pos.top + jq_nd.height() + 15,
            "left": pos.left + 6,
            "background": part.color || "black"
        });
        menu.on("mousedown touchstart", function (evt) {
            evt.stopPropagation();
            var target = $(evt.target);
            if (target.hasClass("menu-item")) {
                target.addClass("clicked");
                menu.fadeOut(200, function () {
                    removeParticipantMenus();
                });
            }
        });
        // this spaces stuff out but also can be used for informational
        $('<div class="info"></div>').appendTo(menu).text(part._id);
        // add menu items
        if (gPianoMutes.indexOf(part._id) == -1) {
            $('<div class="menu-item">Mute Notes</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    gPianoMutes.push(part._id);
                    $(part.nameDiv).addClass("muted-notes");
                });
        } else {
            $('<div class="menu-item">Unmute Notes</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    var i;
                    while ((i = gPianoMutes.indexOf(part._id)) != -1)
                        gPianoMutes.splice(i, 1);
                    $(part.nameDiv).removeClass("muted-notes");
                });
        }
        if (gChatMutes.indexOf(part._id) == -1) {
            $('<div class="menu-item">Mute Chat</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    gChatMutes.push(part._id);
                    $(part.nameDiv).addClass("muted-chat");
                });
        } else {
            $('<div class="menu-item">Unmute Chat</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    var i;
                    while ((i = gChatMutes.indexOf(part._id)) != -1)
                        gChatMutes.splice(i, 1);
                    $(part.nameDiv).removeClass("muted-chat");
                });
        }
        if (!(gPianoMutes.indexOf(part._id) >= 0) || !(gChatMutes.indexOf(part._id) >= 0)) {
            $('<div class="menu-item">Mute Completely</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    gPianoMutes.push(part._id);
                    gChatMutes.push(part._id);
                    $(part.nameDiv).addClass("muted-notes");
                    $(part.nameDiv).addClass("muted-chat");
                });
        }
        if ((gPianoMutes.indexOf(part._id) >= 0) || (gChatMutes.indexOf(part._id) >= 0)) {
            $('<div class="menu-item">Unmute Completely</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    var i;
                    while ((i = gPianoMutes.indexOf(part._id)) != -1)
                        gPianoMutes.splice(i, 1);
                    while ((i = gChatMutes.indexOf(part._id)) != -1)
                        gChatMutes.splice(i, 1);
                    $(part.nameDiv).removeClass("muted-notes");
                    $(part.nameDiv).removeClass("muted-chat");
                });
        }
        if (gClient.isOwner()) {
            $('<div class="menu-item give-crown">Give Crown</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    if (confirm("Give room ownership to " + part.name + "?"))
                        gClient.sendArray([{m: "chown", id: part.id}]);
                });
            $('<div class="menu-item kickban">Kickban</div>').appendTo(menu)
                .on("mousedown touchstart", function (evt) {
                    var minutes = prompt("How many minutes? (0-60)", "30");
                    if (minutes === null) return;
                    minutes = parseFloat(minutes) || 0;
                    var ms = minutes * 60 * 1000;
                    gClient.sendArray([{m: "kickban", _id: part._id, ms: ms}]);
                });
        }
        menu.fadeIn(100);
    };
})();


// Notification class

////////////////////////////////////////////////////////////////

var Notification = function (par) {
    EventEmitter.call(this);

    var par = par || {};

    this.id = "Notification-" + (par.id || Math.random());
    this.title = par.title || "";
    this.text = par.text || "";
    this.html = par.html || "";
    this.target = $(par.target || "#piano");
    this.duration = par.duration || 30000;
    this["class"] = par["class"] || "classic";

    var self = this;
    var eles = $("#" + this.id);
    if (eles.length > 0) {
        eles.remove();
    }
    this.domElement = $('<div class="notification"><div class="notification-body"><div class="title"></div>' +
        '<div class="text"></div></div><div class="x">x</div></div>');
    this.domElement[0].id = this.id;
    this.domElement.addClass(this["class"]);
    this.domElement.find(".title").text(this.title);
    if (this.text.length > 0) {
        this.domElement.find(".text").text(this.text);
    } else if (this.html instanceof HTMLElement) {
        this.domElement.find(".text")[0].appendChild(this.html);
    } else if (this.html.length > 0) {
        this.domElement.find(".text").html(this.html);
    }
    document.body.appendChild(this.domElement.get(0));

    this.position();
    this.onresize = function () {
        self.position();
    };
    window.addEventListener("resize", this.onresize);

    this.domElement.find(".x").click(function () {
        self.close();
    });

    if (this.duration > 0) {
        setTimeout(function () {
            self.close();
        }, this.duration);
    }

    return this;
}

mixin(Notification.prototype, EventEmitter.prototype);
Notification.prototype.constructor = Notification;

Notification.prototype.position = function () {
    var pos = this.target.offset();
    var x = pos.left - (this.domElement.width() / 2) + (this.target.width() / 4);
    var y = pos.top - this.domElement.height() - 8;
    var width = this.domElement.width();
    if (x + width > $("body").width()) {
        x -= ((x + width) - $("body").width());
    }
    if (x < 0) x = 0;
    this.domElement.offset({left: x, top: y});
};

Notification.prototype.close = function () {
    var self = this;
    window.removeEventListener("resize", this.onresize);
    this.domElement.fadeOut(500, function () {
        self.domElement.remove();
        self.emit("close");
    });
};


// set variables from settings or set settings

////////////////////////////////////////////////////////////////

var gKeyboardSeq = 0;
var gKnowsYouCanUseKeyboard = false;
if (localStorage && localStorage.knowsYouCanUseKeyboard) gKnowsYouCanUseKeyboard = true;
if (!gKnowsYouCanUseKeyboard) {
    window.gKnowsYouCanUseKeyboardTimeout = setTimeout(function () {
        window.gKnowsYouCanUseKeyboardNotification = new Notification({
            title: "Did you know!?!",
            text: "You can play the piano with your keyboard, too.  Try it!", target: "#piano", duration: 10000
        });
    }, 30000);
}

// synth
var enableSynth = false;
var osc_types = ["sine", "square", "sawtooth", "triangle"];
var osc_type_index = 1;

var osc1_type = "square";
var osc1_attack = 0;
var osc1_decay = 0.2;
var osc1_sustain = 0.5;
var osc1_release = 2.0;

window.onerror = function (message, url, line) {
    var url = url || "(no url)";
    var line = line || "(no line)";
    // errors in socket.io
    if (url.indexOf("socket.io.js.html") !== -1) {
        if (message.indexOf("INVALID_STATE_ERR") !== -1) return;
        if (message.indexOf("InvalidStateError") !== -1) return;
        if (message.indexOf("DOM Exception 11") !== -1) return;
        if (message.indexOf("Property 'open' of object #<c> is not a function") !== -1) return;
        if (message.indexOf("Cannot call method 'close' of undefined") !== -1) return;
        if (message.indexOf("Cannot call method 'close' of null") !== -1) return;
        if (message.indexOf("Cannot call method 'onClose' of null") !== -1) return;
        if (message.indexOf("Cannot call method 'payload' of null") !== -1) return;
        if (message.indexOf("Unable to get value of the property 'close'") !== -1) return;
        if (message.indexOf("NS_ERROR_NOT_CONNECTED") !== -1) return;
        if (message.indexOf("Unable to get property 'close' of undefined or null reference") !== -1) return;
        if (message.indexOf("Unable to get value of the property 'close': object is null or undefined") !== -1) return;
        if (message.indexOf("this.transport is null.html") !== -1) return;
    }
    // errors in soundmanager2
    if (url.indexOf("soundmanager2.js.html") !== -1) {
        // operation disabled in safe mode?
        if (message.indexOf("Could not complete the operation due to error c00d36ef") !== -1) return;
        if (message.indexOf("_s.o._setVolume is not a function.html") !== -1) return;
    }
    // errors in midibridge
    if (url.indexOf("midibridge") !== -1) {
        if (message.indexOf("Error calling method on NPObject") !== -1) return;
    }
    // too many failing extensions injected in my html
    if (url.indexOf(".js") !== url.length - 3) return;
    // extensions inject cross-domain embeds too
    if (url.toLowerCase().indexOf("sqpiano.com.html") == -1) return;

    // errors in my code
    if (url.indexOf("script.js") !== -1) {
        if (message.indexOf("Object [object Object] has no method 'on'") !== -1) return;
        if (message.indexOf("Object [object Object] has no method 'off'") !== -1) return;
        if (message.indexOf("Property '$' of object [object Object] is not a function") !== -1) return;
    }

    var enc = "/bugreport/"
        + (message ? encodeURIComponent(message) : "") + "/"
        + (url ? encodeURIComponent(url) : "") + "/"
        + (line ? encodeURIComponent(line) : "");
    var img = new Image();
    img.src = enc;
};