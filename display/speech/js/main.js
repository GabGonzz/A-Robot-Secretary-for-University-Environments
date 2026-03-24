class PageManager {
    constructor() {
        // IP Computation, useful to take tests locally
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.11" 
        //                 : window.location.hostname;

        // this.url = "ws://" + robotIP + ":9090";
        this.url = "ws://" + window.location.hostname + ":9090";

        this.ros = new ROSLIB.Ros({
            url: this.url
        });
        
        this.moveInterval = null;

        this.ros.on('connection', () => {
            console.log('ROS connected on ' + this.url);

            // Creation of a CommonDemoARI object to initializate the common logic in the whole project,
            // which is defined in the file ../tools/js/core.js
            this.common_demo = new CommonDemoARI({
                ros: this.ros
            });

            // Subscription to the motion topic, useful to make movements and all the interactions
            this.playMotionTopic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/play_motion/goal',
                messageType: 'play_motion_msgs/PlayMotionActionGoal'
            });

            this.init();
        });

        this.ros.on('error', (error) => {
            console.error('ROS Error:', error);
        });

        // Vocal recognition setup 
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = 'en-EN';
        this.setupRecognition();

    }

    init() {
        this.common_demo.init(() => {
            console.log("CommonDemoARI ready.");

            const interactions = this.common_demo.config.speech.fixed_interactions;
    
            interactions.forEach(inter => {
                $(`#${inter.id}`).on("click", () => {
                    this.common_demo.say(inter.text);
                    this.playAnimation(inter.animation);
                });
            });
        });
    }

    // Function to execute animations
  	playAnimation(motionName){

    	console.log("Sending animation: " + motionName);

		// Publishment of the desired motion on ARI's channel to execute the animation
    	this.playMotionTopic.publish({
      		goal: {
        		motion_name: motionName,
        		skip_planning: true
      		}
    	});

  	}

    // function to make ARI execute one random gesture between the ones that are in the list defined previously
    playRandomGesture() {
        const gestures = this.common_demo.config.speech.available_gestures;
        const randomIndex = Math.floor(Math.random() * gestures.length);
        const selectedGesture = gestures[randomIndex];
        this.playAnimation(selectedGesture);
    }

    // Function to make ARI speak while doing gestures
    ariSpeakWithGestures(text) {

        if (this.moveInterval) clearInterval(this.moveInterval);

        // ARI talks
        this.common_demo.say(text);

        // Estimated speaking duration
        const estimatedDurationMs = (text.length / 15) * 1000;
        
        // Start random gestures, with the first starting immediately
        this.playRandomGesture();
        
        // computation of the start time, useful to understand how much time is left
        // in the speaking
        let startTime = Date.now();

        //we set ARI to make a gesture once every 8 seconds until the estimated time
        // has been reached
        this.moveInterval = setInterval(() => {
            let elapsed = Date.now() - startTime;
            
            // It keeps moving only if the estimated duration has not been reached yet
            if (elapsed < estimatedDurationMs) {
                this.playRandomGesture();
            } else {
                console.log("Fine parlato, stop gesti.");
                clearInterval(this.moveInterval);
                this.playAnimation('nod');
            }
        }, 9000); // One gesture every 8 seconds
    }

    // function to setup the vocal recognition, which starts when the microphone button in the html page
    // will be pressed
    setupRecognition(){

        this.recognition.onstart = () => {
            $("#btn-ai-mic").css("background-color", "#ff0000");
        };

        // converts the speech of the user to text (STT) to send it to the LLM (in this case being Gemini)
        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("User said: " + transcript);
            
            // PREPARAZIONE POP-UP (Loading state)
            $("#ai-response-text").hide().text(""); 
            // Manteniamo la domanda dell'utente nel titolo
            $("#ai-modal-title").html("Thinking... <br><small style='font-size: 1.2rem; color: #666;'>I heard: \"" + transcript + "\"</small>");
            $("#ai-loading-icon").show();
            $("#ai-modal-footer").hide();
            $("#ai-modal").fadeIn(300);

            // waits for the response of the LLM and then it makes ARI say that response
            const aiResponse = await this.getAIResponse(transcript);

            // AGGIORNAMENTO POP-UP (Response state)
            $("#ai-loading-icon").hide();
    
            // Cambiamo solo la parola "Thinking..." con "Answer" ma lasciamo il "I heard..."
            $("#ai-modal-title").html("ARI's Answer <br><small style='font-size: 1.2rem; color: #666;'>I heard: \"" + transcript + "\"</small>");
    
            $("#ai-response-text").text(aiResponse).fadeIn(300);
            $("#ai-modal-footer").show();

            this.ariSpeakWithGestures(aiResponse);
        };

        this.recognition.onend = () => {
            $("#btn-ai-mic").css("background-color", "#990000");
        };
    }

    // function to send the text (which has been previously converted from speech) to the LLM and 
    // get the answer to the user's question
    async getAIResponse(text) {

        const systemPrompt = this.common_demo.config.speech.llm_context;

        // key to use Gemini, it is stored in config.js but not shared on github
        if (typeof GEMINI_API_KEY === 'undefined') {
            console.error("Errore: GEMINI_API_KEY non trovata. Controlla config.js");
            return "My configuration is missing.";
        }

        // we use gemini flash latest to answer the user's question
        const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        // we send a POST request to the LLM's URL to get the answer to the user's question. In the text
        // part I added an overview of the context in which ARI is in, to help it answer better to the
        // user's questions
        try {
            const response = await fetch(URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: systemPrompt + text
                        }]
                    }]
                })
            });

            const data = await response.json();

            // return of the answer to make ARI read it, if it was correctly handled
            if (data.candidates && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                console.error("Unexpected JSON structure:", data);
                return "I understood you, but I'm having trouble phrasing the answer.";
            }
        } catch (e) {
            console.error("Fetch error:", e);
            return "My connection to the cloud is a bit shaky.";
        }
    }

    startListening() {
        this.recognition.start();
    }
}



$(document).ready(function() {
    const page_manager = new PageManager();

    // Button to answer the user's question with Gemini
    $("#btn-ai-mic").on("click", function() {
        page_manager.startListening();
    });

    $("#btn-ai-close").on("click", function() {
        $("#ai-modal").fadeOut(300);
    });

    // Back to the previous screen
    $(".control-btn[title='Back']").on("click", function() {

        window.location.href = "../unitn_interactions_menu/index.html";

    });  

    // Back to the home screen
    $(".control-btn[title='Home']").on("click", function() {

        window.location.href = "../unitn_main_menu/index.html";

    });
});