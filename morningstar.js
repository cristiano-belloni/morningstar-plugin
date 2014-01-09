define(['require',
        'github:janesconference/KievII@0.6.0/kievII'], function(require, K2) {
    
    /* This gets returned to the host as soon as the plugin is loaded */
    var pluginConf = {
        name: "MorningStar",
        osc: false,
        audioIn: 0,
        audioOut: 1,
        version: '0.0.2',
        ui: {
            type: 'canvas',
            width: 657,
            height: 450
        }
    };
  
    /* This gets called when all the resources are loaded */
    var pluginFunction = function (args, resources) {
        var MorningStarSynth = resources[0];
        var blackKnobImage = resources[1];
        var whiteKnobImage = resources[2];
        var deckImage = resources[3];
        var keyBlackImage = resources[4];
        var keyWhiteImage = resources[5];
        var keyBlackDownImage = resources[6];
        var keyWhiteDownImage = resources[7];
        
        this.name = args.name;
        this.id = args.id;

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;  
        }
        else {
            /* Use default data */
            this.pluginState = {
                envelope: 0.6,
                release: 0.75,
                cutoff: 0.4,
                resonance: 0.75,
                volume: 1,
                velocity: 1
            };
        }
        
        // The sound part
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;
        var context = this.context;
		
        this.MSS = new MorningStarSynth();
        this.MSS.init(context, this.audioDestination);
        
        // The graphical part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas}, {'breakOnFirstEvent': true});
        
        /* BACKGROUND INIT */
        
        var bgArgs = new K2.Background({
            ID: 'background',
            image: deckImage,
            top: 0,
            left: 0
        });
    
        this.ui.addElement(bgArgs, {zIndex: 0});
        
        /* LABEL INIT */
        this.label = new K2.Label({
            ID: 'statusLabel',
            width : 320,
            height : 29,
            top : 196,
            left : 42,
            transparency: 0.87,
            objParms: {
                font: "28px VT323",
                textColor: "#000",
                textBaseline: "top",
                textAlignment: "left"
            }
        });
        this.ui.addElement(this.label, {zIndex: 3});
       
        /* KEYS */
        this.viewWidth = args.canvas.width;
        this.viewHeight = args.canvas.height;
        
        var keyCallback = function (slot, value, element) {
            
            var stIndex = 0;
            var stPower = 0;
            var whiteKeysSemitones = [0,2,4,5,7,9,11,12,14,16,17,19,21,23,24,26,28,29,31,33,35,36];
            var blackKeysSemitones = [1,3,6,8,10,13,15,18,20,22,25,27,30,32,34];
            
            if (element.indexOf("wk_") === 0) {
                stIndex = element.split("wk_")[1];
                stPower = whiteKeysSemitones[stIndex];
            }
            
            else  if (element.indexOf("bk_") === 0) {
                stIndex = element.split("bk_")[1];
                stPower = blackKeysSemitones[stIndex];
            }
            
            else {
                return;
            }
            
            if (value === 1) {
                this.MSS.noteOn(stPower - 33, this.velocity);
            }
            else if (value === 0) {
                this.MSS.noteOff();
            }
         
            this.ui.refresh();
        }.bind(this);
            
        // White keys
        var whiteKeyArgs = {
            ID: "",
            left: 0,
            top: 0,
            mode: 'immediate',
            imagesArray : [keyWhiteImage, keyWhiteDownImage],
            onValueSet: keyCallback
        };
        
        for (var i = 0; i < 21; i+=1) {
            whiteKeyArgs.top = 300;
            whiteKeyArgs.left = 14 + i * 30;    
            whiteKeyArgs.ID = "wk_" + i;
            this.ui.addElement(new K2.Button(whiteKeyArgs), {zIndex: 1});
        }
        
        // Black keys
        var blackKeyArgs = {
                ID: "",
                left: 0,
                top: 0,
                mode: 'immediate',
                imagesArray : [keyBlackImage, keyBlackDownImage],
                onValueSet: keyCallback
            };
            
            var bkArray = [34, 64, 124, 154, 184, 244, 274, 334, 364, 394, 454, 484, 544, 574, 604];
        
            for (var i = 0; i < bkArray.length; i+=1) {
                blackKeyArgs.top = 299;
                blackKeyArgs.left = bkArray[i];    
                blackKeyArgs.ID = "bk_" + i;
                this.ui.addElement(new K2.Button(blackKeyArgs), {zIndex: 10});
            }
            
        this.knobDescription = [ {id: 'envelope', init: this.pluginState.envelope, type: 'white'},
                                 {id: 'release', init: this.pluginState.release, type: 'white'},
                                 {id: 'cutoff', init: this.pluginState.cutoff, type: 'white'},
                                 {id: 'resonance', init: this.pluginState.resonance, type: 'white'},
                                 {id: 'velocity', init: this.pluginState.velocity, type: 'black'},
                                 {id: 'volume', init: this.pluginState.volume, type: 'black'}
                              ];
        /* KNOB INIT */
       var knobArgs = {
            ID: '',
            left: 0 ,
            top: 0,
            image : null,
            sensitivity : 5000,
            initAngValue: 270,
            startAngValue: 218,
            stopAngValue: 501,
            onValueSet: function (slot, value, element) {
                this.pluginState[element] = value;
				switch (element) {
					case 'volume':
						this.MSS.setVolume(value);
						this.ui.setValue({elementID: "statusLabel", value: "Volume: " + Math.round(value * 127)});
					    break;
					case 'velocity':
						var velocity = K2.MathUtils.linearRange (0, 1, 0, 127, value);
						this.velocity = Math.round(velocity);
						this.ui.setValue({elementID: "statusLabel", value: "Velocity: " + this.velocity});
					    break;
					case 'envelope':
						var envelope = K2.MathUtils.linearRange (0, 1, 0, 127, value);
						this.MSS.setEnvelope(envelope);
						this.ui.setValue({elementID: "statusLabel", value: "Envelope: " + Math.round(envelope)});
					    break;
					case 'release':
						var release = K2.MathUtils.linearRange (0, 1, 0, 127, value);
						this.MSS.setRelease(release);
						this.ui.setValue({elementID: "statusLabel", value: "Release: " + Math.round(release)});
						break;
					case 'cutoff':
						var cutoff = K2.MathUtils.linearRange (0, 1, 0, 127, value);
						this.MSS.setCutoff(cutoff);
						this.ui.setValue({elementID: "statusLabel", value: "Cutoff: " + Math.round(cutoff)});
					    break;	
					case 'resonance':
						var resonance = K2.MathUtils.linearRange (0, 1, 0, 127, value);
						this.MSS.setResonance(resonance);
						this.ui.setValue({elementID: "statusLabel", value: "Resonance: " + Math.round(resonance)});
					    break;	
					
				}
                
                this.ui.refresh();
            }.bind(this),
            isListening: true
        };
        
        var whiteInit = 44;
        var whiteSpacing = 165;
        var blackInit = 347;
        var blackSpacing = 101;
        var whiteTop = 34;
        var blackTop = 180;
        
        for (i = 0; i < this.knobDescription.length; i+=1) {
            var currKnob = this.knobDescription[i];
            
            knobArgs.ID = currKnob.id;
            
            if (currKnob.type === 'white') {
                knobArgs.image = whiteKnobImage;
                knobArgs.top = whiteTop;
                knobArgs.left = (whiteInit + i * whiteSpacing);
             }
            else if (currKnob.type === 'black') {
                knobArgs.image = blackKnobImage;
                knobArgs.top = blackTop;
                knobArgs.left = (blackInit + (i - 3) * blackSpacing);
            }
             
            this.ui.addElement(new K2.RotKnob(knobArgs));
            var initValue = currKnob.init;
            this.ui.setValue ({elementID: knobArgs.ID, value: initValue});
        }

        this.ui.setValue({elementID: "statusLabel", value: "MorningStar ready."});
        this.ui.refresh();

        var saveState = function () {
            return { data: this.pluginState };
        };
        args.hostInterface.setSaveState (saveState.bind (this));

        var onMIDIMessage = function (message, when) {
            if (message.type === 'noteon') {
                if (!when) {
                    this.MSS.noteOn(message.pitch - 33, message.velocity);
                }
                else {
                    var now = this.context.currentTime;
                    console.log ("arrived on message: when / now", when, now);
                    if (when < now) {
                        console.log ("MORNINGSTAR: ******** OUT OF TIME ON MESSAGE");
                    }
                    this.MSS.noteOnDeferred(message.pitch - 33, message.velocity, when);
                }
            }
            if (message.type === 'noteoff') {
                if (!when) {
                    this.MSS.noteOff();
                }
                else {
                    console.log ("arrived off message: when / now", when, now);
                    if (when < now) {
                        console.log ("MORNINGSTAR: ******** OUT OF TIME OFF MESSAGE");
                    }
                    this.MSS.noteOffDeferred(when);
                }
            }
        };

        args.MIDIHandler.setMIDICallback (onMIDIMessage. bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
        
    };
  
  
    /* This function gets called by the host every time an instance of
       the plugin is requested [e.g: displayed on screen] */
    var initPlugin = function(initArgs) {
        var args = initArgs;

        var requireErr = function (err) {
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error loading plugin resources'});
        }.bind(this);

        var resList = [ './assets/js/synth',
                        './assets/images/bknob.png!image',
                        './assets/images/wknob.png!image',
                        './assets/images/msdeck.png!image',
                        './assets/images/keyblack.png!image',
                        './assets/images/keywhite.png!image',
                        './assets/images/keyblack_down.png!image',
                        './assets/images/keywhite_down.png!image',
                        '#google VT323 !font'];

        require (resList,
            function () {
                var resources = arguments;
                pluginFunction.call (this, args, resources);
            }.bind(this),
            function (err) {
                requireErr (err);
            }
        );

    };
    
    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
