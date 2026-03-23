class PageManager{
 	constructor(){
    	// IP Computation, useful to take tests locally
        const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
                        ? "10.160.50.11" 
                        : window.location.hostname;

        this.url = "ws://" + robotIP + ":9090";
    //    this.url = "ws://" + window.location.hostname + ":9090";
    	this.ros = new ROSLIB.Ros({
      		url: this.url
    	});

    	this.ros.on('connection', () => {
      	console.log('Connesso a ROS su ' + this.url);
      
		// Creation of a CommonDemoARI object to initializate the common logic in the whole project,
        // which is defined in the file ../tools/js/core.js
      	this.common_demo = new CommonDemoARI({
        	ros: this.ros
      	});

      	this.init();
    	});

    	this.ros.on('error', (error) => {
      		console.error('ROS Error:', error);
    	});

		// Configurazione Vocale
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = 'en-EN';
        this.setupVoiceCommands();
  	}

  	init() {
    	this.common_demo.init(() => {
            const config = this.common_demo.config;
            if (config && config.points_of_interest) {
                this.renderPoiList(config.points_of_interest);
            }
    	});
  	}

    renderPoiList(poiList) {
        const container = $("#dynamic-poi-list");
        container.empty();

        poiList.forEach(poi => {
            const poiDiv = $(`<div class="poi-item" id="${poi.id}">${poi.name}</div>`);
            
            // Al click sul pulsante generato
            poiDiv.on("click", () => {
                this.showConfirmation(poi.name);
            });

            container.append(poiDiv);
        });
    }

	setupVoiceCommands() {
        this.recognition.onstart = () => {
            $("#btn-poi-mic").css("background-color", "#ff0000");
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log("ARI heard: " + transcript);

            if (!this.common_demo.config || !this.common_demo.config.points_of_interest) {
                console.error("Configurazione non ancora caricata");
                return;
            }

            // Lista dei POI e parole chiave associate
            const poiList = this.common_demo.config.points_of_interest;

            // Cerchiamo se il transcript contiene una delle parole chiave
            let foundPoi = poiList.find(poi => 
                poi.keywords.some(keyword => transcript.includes(keyword))
            );

            if (foundPoi) {
                this.showConfirmation(foundPoi.name);
            } else {
                this.common_demo.say("I'm sorry, I couldn't find that place. Try again.");
            }
        };

        this.recognition.onend = () => {
            $("#btn-poi-mic").css("background-color", "#990000");
        };
    }

    showConfirmation(destination) {
        $("#modal-text").text("Do you want to go to " + destination + "?");
        $("#confirmation-modal").fadeIn(300);
        this.common_demo.say("Do you want to go to " + destination + "?");
    }

    startListening() {
        this.recognition.start();
    }
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

	// Avvio microfono
    $("#btn-poi-mic").on("click", function() {

        page_manager.startListening();

    });

    // If the user cancels the decision, the pop-up disappears
    $("#confirm-no").on("click", function() {
        $("#confirmation-modal").fadeOut(300);
    });

    // If the user confirms the decision, ARI will go to the destination with the user, however, currently
    // the pop-up just disappears, later the logic will be implemented
    $("#confirm-yes").on("click", function() {
        console.log("Confirm decision");
        $("#confirmation-modal").fadeOut(300);
    });

});