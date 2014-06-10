(function (window) {

    function MorningStarSynth() {

        this.synth = {
            phase : 0,
            freq : 440,
            tfreq : 440,
            amp : 0,
            env : 0,
            fcutoff : 0,
            fspeed : 0,
            fpos : 0,
            freso: 0,
            lastsample : 0,
            /* int */          noteson : 0,
            /* unsigned int */ vel : 0,
            /* unsigned int */ cdelay : 0,
            /* unsigned int */ release : 100,
            /* unsigned int */ cutoff : 50,
            /* unsigned int */ envmod : 80,
            /* unsigned int */ resonance : 100,
            /* unsigned int */ volume : 100,
            /* unsigned int */ portamento : 64
        };

        this.synth.events = {};

        this.synth.tanh = function (arg) {
            return (Math.exp(2 * arg) - 1) / (Math.exp(2 * arg) + 1);
        };

        this.synth.handleEvent = function (ea) {
            var len = ea.length;
            for (var evIndex = 0; evIndex < len; evIndex +=1 ) {
                var event = ea[evIndex];
                // Apply the scheduled event.
                switch (event.type) {
                    case "note-on":
                        if(this.noteson === 0) {
                            this.freq = this.tfreq = event.tfreq;
                            this.amp = event.amp;
                            this.vel = event.vel;
                            this.env = event.env;
                            this.cdelay = event.cdelay;
                        }

                        else {
                            this.tfreq = event.tfreq;
                        }

                        this.noteson += 1;
                        break;

                    case "note-off":
                        this.noteson -= 1;
                        if (this.noteson < 0) {
                            this.noteson = 0;
                        }
                        break;
                    case "cutoff":
                        this.cutoff = event.cutoff;
                        break;
                    case "resonance":
                        this.resonance = event.resonance;
                        break;
                    case "release":
                        this.release = event.release;
                        break;
                    case "envelope":
                        this.envmod = event.envmod;
                        break;
                }
            }
            
        };

        this.synth.consumeEvent = function (now) {
            var ret = this.events[now];
            if (ret) {
                delete this.events[now];
                //console.log ("afer consume", this.events);
            }
            return ret;
        };

        this.synth.process = function (data, time) {

        var i;

        // Upmix to stereo if given two channels (array of arrays). Could be implemented
        // more elegantly.
        var len = data.length;
        if (len == 2) len = data[0].length;

            if (this.bypass === false) {
   
                for( i = 0; i < len; i+=1) {

                    var timePlusSample = time + i;
                    var event = this.consumeEvent(timePlusSample);

                    if (event) {
                        this.handleEvent(event);
                    }

                    if(this.cdelay <= 0) {

                        this.freq = ((this.portamento / 127) * 0.9) * this.freq + (1 - ((this.portamento / 127) * 0.9)) * this.tfreq;

                        if(this.noteson > 0) {
                            this.amp *= 0.99;
                        }
                        else {
                            this.amp *= 0.5;
                        }

                        this.env *= 0.8 + Math.pow (this.release / 127, 0.25) / 5.1;
                        this.fcutoff = Math.pow (this.cutoff / 127, 2) + Math.pow (this.env, 2) * Math.pow (this.envmod / 127, 2);
                        this.fcutoff = this.tanh(this.fcutoff);
                        this.freso = Math.pow (this.resonance / 130, 0.25);
                        this.cdelay = Math.floor(this.sampleRate / 100);
                    }
                    this.cdelay--;

                    this.max = this.sampleRate / this.freq;
                    this.sample = (this.phase / this.max) * (this.phase / this.max) - 0.25;
                    this.phase++;
                    if( this.phase >= this.max )
                    this.phase -= this.max;

                    if (this.vel > 100) {
                        this.sample *= this.env;
                    }
                    else {
                        this.sample *= this.amp;
                    }

                    this.fpos += this.fspeed;
                    this.fspeed *= this.freso;
                    this.fspeed += (this.sample - this.fpos) * this.fcutoff;
                    this.sample = this.fpos;

                    this.sample = this.sample * 0.5 + this.lastsample * 0.5;
                    this.lastsample = this.sample;
                    
                    // Velocity control does nothing, had to use it as a gain here.
                    var curr_sample = this.sample * (this.volume / 127) * (this.vel / 127) ;
                    
                    // Upmix to stereo if given two channels (array of arrays)
                    if (data.length === 2) {
                        data[0][i] = 0.707 * curr_sample;
                        data[1][i] = 0.707 * curr_sample;
                    }
                    
                    // Mono if given only one channel (array)
                    else {
                        data[i] = curr_sample;
                    }
                    
                }
            }
        };

        this.synth.init = function (sampleRate) {
            this.sampleRate = sampleRate;
            this.phase = 0;
            this.freq = 440;
            this.tfreq = 440;
            this.amp = 0;
            this.fcutoff = 0;
            this.fspeed = 0;
            this.fpos = 0;
            this.lastsample = 0;
            this.noteson = 0;
            this.cdelay = Math.floor(sampleRate / 100);

            /* These are to be set externally */
            this.release = 100;
            this.cutoff = 50;
            this.envmod = 80;
            this.resonance = 100;
            this.volume = 100;
            this.portamento = 64;
            this.bypass = false;
        };

        this.getProcess = function () {
            var that = this;
            var fn = function(event) {
                // Get left/right input and output arrays
                var outputArray = [];
                outputArray[0] = event.outputBuffer.getChannelData(0);
                outputArray[1] = event.outputBuffer.getChannelData(1);
                that.synth.process (outputArray, Math.round(event.target.context.currentTime * that.synth.sampleRate));
            };
            return fn;
        };

        this.init = function (context, destination) {
         
            this.nSamples = 2048;
            this.wsCurve = new Float32Array(this.nSamples);

            this.context = context;

            this.synth.init(this.context.sampleRate);

            this.source = this.context.createJavaScriptNode(this.nSamples);
            this.source.onaudioprocess = this.getProcess();

            this.gainNode = this.context.createGain();
            this.source.connect(this.gainNode);
            this.gainNode.connect(destination);

            
        };

        this.noteOn = function (noteNum, velocity) {
            if(this.synth.noteson === 0) {
                this.synth.freq = this.synth.tfreq = 440 * Math.pow(2, (noteNum) / 12);
                this.synth.amp = 1;
                this.synth.vel = velocity;
                this.synth.env = this.synth.vel / 127;
                this.synth.cdelay = 0;
            }

            else {
                this.synth.tfreq = 440.0 * Math.pow (2, (noteNum) / 12);
            }
            this.synth.noteson += 1;
        };

        this.noteOff = function () {
            this.synth.noteson -= 1;
            if (this.synth.noteson < 0) {
                this.synth.noteson = 0;
            }
        };

        this.scheduleDeferredEvent = function (event, sampleWhen) {
            if (!this.synth.events[sampleWhen]) {
                this.synth.events[sampleWhen] = [event];
            }
            else {
                this.synth.events[sampleWhen].push(event);
            }
        };

        this.noteOnDeferred = function (noteNum, velocity, when) {
            
            var event = {
                type: "note-on",
                amp: 1,
                vel: velocity,
                env: this.synth.vel / 127,
                cdelay: 0,
                tfreq: 440.0 * Math.pow (2, (noteNum) / 12)
            };

            var sampleWhen = Math.round(when * this.synth.sampleRate);

            this.scheduleDeferredEvent (event, sampleWhen);
        };

        this.noteOffDeferred = function (when) {

            var event = {
                type: "note-off"
            };

            var sampleWhen = Math.round(when * this.synth.sampleRate);

            this.scheduleDeferredEvent (event, sampleWhen);
        };

        // Setters

        this.setCutoff = function (cutoffValue) {
            this.synth.cutoff = cutoffValue;
        };

        this.setCutoffDeferred = function (cutoffValue, when) {
            var sampleWhen = Math.round(when * this.synth.sampleRate);
            var event = {
                type: "cutoff",
                cutoff: cutoffValue
            };
            this.scheduleDeferredEvent (event, sampleWhen);
        };

        this.setResonance = function (resValue) {
            this.synth.resonance = resValue;
        };

        this.setResonanceDeferred = function (resValue, when) {
            var sampleWhen = Math.round(when * this.synth.sampleRate);
            var event = {
                type: "resonance",
                resonance: resValue
            };
            this.scheduleDeferredEvent (event, sampleWhen);
        };

        this.setPortamento = function (portValue) {
            this.synth.portamento = portValue;
        };

        this.setRelease = function (relValue) {
            this.synth.release = relValue;
        };

        this.setReleaseDeferred = function (relValue, when) {
            var sampleWhen = Math.round(when * this.synth.sampleRate);
            var event = {
                type: "release",
                release: relValue
            };
            this.scheduleDeferredEvent (event, sampleWhen);
        };

        this.setEnvelope = function (envValue) {
            this.synth.envmod = envValue;
        };

        this.setEnvelopeDeferred = function (envValue, when) {
            var sampleWhen = Math.round(when * this.synth.sampleRate);
            var event = {
                type: "envelope",
                envmod: envValue
            };
            this.scheduleDeferredEvent (event, sampleWhen);
        };

        this.setVolume = function (volValue) {
            this.gainNode.gain.value = volValue;
        };

        this.setBypass = function (bypassON) {
            this.synth.bypass = bypassON;
        };

        //Getters

        this.getCutoff = function () {
            return this.synth.cutoff;
        };

        this.getResonance = function () {
            return this.synth.resonance;
        };

        this.getPortamento = function () {
            return this.synth.portamento;
        };

        this.getRelease = function () {
            return this.synth.release;
        };

        this.getEnvelope = function () {
            return this.synth.envmod;
        };

        this.getVolume = function () {
            return this.gainNode.gain.value;
        };

        this.getBypass = function () {
            return this.synth.bypass;
        };

    }

    if (typeof define === "function" && define.amd) {
        define([], function() {
            return MorningStarSynth;
        });
    }
    else {
        window.MorningStarSynth = MorningStarSynth;
    }

})(this);