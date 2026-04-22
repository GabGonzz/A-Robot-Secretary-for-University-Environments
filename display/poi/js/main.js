class PageManager{
 	constructor(){
    	// IP Computation, useful to take tests locally
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.16" 
        //                 : window.location.hostname;

        // this.url = "ws://" + robotIP + ":9090";
        this.url = "ws://" + window.location.hostname + ":9090";
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

		// Vocal recognition configuration
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = 'en-EN';
        this.setupVoiceCommands();

        this.selectedDestinationId = null;
        this.selectedDestinationRosName = null;
  	}

  	init() {
    	this.common_demo.init(() => {
            const config = this.common_demo.config;
            if (config && config.points_of_interest) {
                this.renderPoiList(config.points_of_interest);
            }
            this.startDockStatusWatcher();

            this.common_demo.subscribeToCalibration((msg) => {
                
            });
    	});
  	}

    //function to load the poi list that is in the configuration file
    renderPoiList(poiList) {
        const container = $("#dynamic-poi-list");
        container.empty();

        poiList.forEach(poi => {
            const poiDiv = $(`<div class="poi-item" id="${poi.id}">${poi.name}</div>`);
            
            // when a poi button will be clicked, it will show the confirmation button to make sure 
            // if the user does really want to go there
            poiDiv.on("click", () => {
                this.selectedDestinationId = poi.id;
                this.selectedDestinationRosName = poi.ros_name;
                this.showConfirmation(poi.name);
            });

            container.append(poiDiv);
        });
    }

    // function to set up the vocal commands received by ARI
	setupVoiceCommands() {

        //when the microphone starts listening, it changes its color
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

            // loading of the list of pois from the configuration file
            const poiList = this.common_demo.config.points_of_interest;

            // check if the transcript contains one of the keywords representing one of the pois
            let foundPoi = poiList.find(poi => 
                poi.keywords.some(keyword => transcript.includes(keyword))
            );

            // if a poi was recognised, then it will be shown the confirmation button to check 
            // the user's intentions, if not, ARI will communicate that it didn't heard any keyword 
            // related to any poi
            if (foundPoi) {
                this.selectedDestinationId = foundPoi.id;
                this.selectedDestinationRosName = foundPoi.ros_name;
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

    // Funzione per monitorare lo stato di ricarica e aggiornare il testo/stile del bottone
    startDockStatusWatcher() {
        // Poiché core.js aggiorna common_demo.isCharging, controlliamo periodicamente
        setInterval(() => {
            const btn = $("#dock-btn");
            const isCharging = this.common_demo.isCharging; // Verificato dal topic /power/is_charging

            if (isCharging) {
                btn.html('<i class="fa-solid fa-plug-circle-minus"></i> UNDOCK');
                btn.removeClass("dock-state-off").addClass("dock-state-on");
            } else {
                btn.html('<i class="fa-solid fa-plug-circle-bolt"></i> DOCK ARI');
                btn.removeClass("dock-state-on").addClass("dock-state-off");
            }
        }, 500); // Aggiorna ogni mezzo secondo
    }
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_navigation_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

	// microphone starts listening
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
        console.log("Decisione confermata per: " + page_manager.selectedDestinationRosName);
        
        // Invia il comando al core.js che lo pubblicherà su ROS
        page_manager.common_demo.sendSmartNav(page_manager.selectedDestinationRosName);
        
        // ARI comunica che sta partendo
        page_manager.common_demo.say("Okay, let's go!");
        
        $("#confirmation-modal").fadeOut(300);
    });

    $("#dock-btn").on("click", function() {
        // Usiamo la variabile isCharging gestita dal core.js
        if (page_manager.common_demo.isCharging) {
            console.log("Invio UNDOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("UNDOCK_MANUAL");
            page_manager.common_demo.say("I am undocking, please stand back.");
        } else {
            console.log("Invio DOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("DOCK_MANUAL");
            page_manager.common_demo.say("I am starting the docking procedure.");
        }
    });

});