  window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame    ||
              window.oRequestAnimationFrame      ||
              window.msRequestAnimationFrame     ||
              function(callback, element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();


    // Global Variables for Audio
    var audioContext;

    var sourceNode;
    var analyserNode;
    var javascriptNode;
    var playbackSourceNode;
    var audioStream;
    var array = [];

    var recording = null;  // this is the cumulative buffer for your recording

    var audioBufferNode = null;
    var audioBuffer = null;

    // Global Variables for Drawing
    var x = 0;
    var canvasWidth  = 800;
    var canvasHeight = 256;
    var ctx;

    // Uses the chroma.js library by Gregor Aisch to create a tasteful color gradient
    // download from https://github.com/gka/chroma.js
    var hot = new chroma.ColorScale({
        colors:['#000000', '#ff0000', '#ffff00', '#ffffff'],
        positions:[0, .25, .75, 1],
        mode:'rgb',
        limits:[0, 256]
    });


    window.craicAudioContext = (function(){
      return  window.webkitAudioContext || window.AudioContext ;
    })();

    navigator.getMedia = ( navigator.mozGetUserMedia ||
                           navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.msGetUserMedia);

    $(document).ready(function() {


        // Check that the browser can handle web audio
        try {
//            audioContext = new webkitAudioContext();
            audioContext = new craicAudioContext();

        }
        catch(e) {
            alert('Web Audio API is not supported in this browser');
        }

        // get the input audio stream and set up the nodes
        try {
            // calls the function setupAudioNodes
//            navigator.webkitGetUserMedia({audio:true}, setupAudioNodes, onError);
            navigator.getMedia({audio:true}, emitToServer, onError);

        } catch (e) {
            alert('webkitGetUserMedia threw exception :' + e);
        }


        // Start recording by setting onaudioprocess to the function that manages the recording buffer
        $("body").on('click', "#start_button",function(e) {
            e.preventDefault();

            // execute every time a new sample has been acquired
            javascriptNode.onaudioprocess = function (e) {

                addSampleToRecording(e.inputBuffer);

                // Analyze the frequencies in this sample and add to the spectorgram
                analyserNode.getByteFrequencyData(array);
                requestAnimFrame(drawSpectrogram);
            }
        });

        // Stop recording by setting onaudioprocess to null
        $("body").on('click', "#stop_button",function(e) {
            e.preventDefault();
            javascriptNode.onaudioprocess = null;
         });

        // Play the recording
        $("body").on('click', "#playback_button",function(e) {
            e.preventDefault();
            playRecording();
         });

        // Reset the recording buffer and the graphics, but keep the nodes connected
        $("body").on('click', "#reset_button",function(e) {
            e.preventDefault();
            recording = null;
            clearCanvas();
         });

        // Disable audio completely
        $("body").on('click', "#disable_audio",function(e) {
            e.preventDefault();
            javascriptNode.onaudioprocess = null;
            if(audioStream)  audioStream.stop();
            if(sourceNode)  sourceNode.disconnect();
         });
    });

    function onError(e) {
        console.log(e);
    }



    function emitToServer(stream)
    {
        socket.emit("audio",stream);
    }
    function setupAudioNodes(stream) {
        var sampleSize = 1024;  // number of samples to collect before analyzing FFT
                                // decreasing this gives a faster sonogram, increasing it slows it down
        audioStream = stream;

        // The nodes are:  sourceNode -> analyserNode -> javascriptNode -> destination

        // create an audio buffer source node
        sourceNode = audioContext.createMediaStreamSource(audioStream);

        // Set up the javascript node - this uses only one channel - i.e. a mono microphone
        javascriptNode = audioContext.createJavaScriptNode(sampleSize, 1, 1);

        // setup the analyser node
        analyserNode = audioContext.createAnalyser();
        analyserNode.smoothingTimeConstant = 0.0;
        analyserNode.fftSize = 1024; // must be power of two

        // connect the nodes together
        sourceNode.connect(analyserNode);
        analyserNode.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);

        // optional - connect input to audio output (speaker)
        // This will echo your input back to your speakers - Beware of Feedback !!
        // sourceNode.connect(audioContext.destination);

        // allocate the array for Frequency Data
        array = new Uint8Array(analyserNode.frequencyBinCount);
    }


    // Draw the Spectrogram from the frequency array
    // adapted from http://www.smartjava.org/content/exploring-html5-web-audio-visualizing-sound
    function drawSpectrogram() {

        for (var i = 0; i < array.length; i += 1) {
            // Get the color for each pixel from a color map
            var value = array[i];
            ctx.beginPath();
            ctx.strokeStyle = hot.getColor(value).hex();

            // draw a 1 pixel wide rectangle on the canvas
            var y = canvasHeight - i;
            ctx.moveTo(x, y);
            ctx.lineTo(x+1, y);
            ctx.closePath();
            ctx.stroke();
        }

        // loop around the canvas when we reach the end
        x = x + 1;
        if(x >= canvasWidth) {
            x = 0;
            clearCanvas();
        }
    }


    function clearCanvas() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        x = 0;
    }

    socket.on('audio', function(data)
    {
       alert('got data');
       console.log("audio data: ",data);
    });

