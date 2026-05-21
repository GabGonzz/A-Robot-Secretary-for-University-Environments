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
        this.isWaitingForConfirmation = false;
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

            // subscription to the aruco calibration topic
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
            
            // Check if we are waiting for the user to confirm the destination
            if (this.isWaitingForConfirmation) {

                // Check the user's response, if it's positive, then we will send the 
                // selected destination to the navigation system, else we will cancel the action
                if (transcript.includes("yes") || transcript.includes("yeah") || transcript.includes("sure")) {
                    console.log("Decision confermed vocally to: " + this.selectedDestinationRosName);
                    
                    this.common_demo.sendSmartNav(this.selectedDestinationRosName);
                    this.common_demo.say("Okay, let's go!");
                    $("#confirmation-modal").fadeOut(300);
                    
                    // Reset the flag
                    this.isWaitingForConfirmation = false;
                } 
                else if (transcript.includes("no") || transcript.includes("nope")) {
                    console.log("Decision canceled vocally.");
                    
                    $("#confirmation-modal").fadeOut(300);
                    
                    // Reset the confirmation flag
                    this.isWaitingForConfirmation = false;
                } 
                else {
                    //If ARI did not recognise what the user said, it will give up listening 
                    // and just show the confirmation modal
                    this.common_demo.say("Please say yes or no.");
                }
                return;
            }

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

        // Set the confirmation flag
        this.isWaitingForConfirmation = true;

        // Restart the microphone when ARI will be done talking
        setTimeout(() => {
            try {
                this.startListening();
            } catch(e) {
                console.log("The microphone is already listening.");
            }
        }, 2500);
    }

    startListening() {
        this.recognition.start();
    }

    // Functiont to check if ARI is charging or not and changes the aspect of the dock/undock button accordingly
    startDockStatusWatcher() {
        // Periodically check at the isCharging variable
        setInterval(() => {
            const btn = $("#dock-btn");
            const isCharging = this.common_demo.isCharging;

            // check if ARI is charging or not and change the aspect of the dock/undock button accordingly
            if (isCharging) {
                btn.html('<i class="fa-solid fa-plug-circle-minus"></i> UNDOCK');
                btn.removeClass("dock-state-off").addClass("dock-state-on");
            } else {
                btn.html('<i class="fa-solid fa-plug-circle-bolt"></i> DOCK ARI');
                btn.removeClass("dock-state-on").addClass("dock-state-off");
            }
        }, 500); // updates every half a second
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
        page_manager.isWaitingForConfirmation = false;
    });

    // If the user confirms the decision, ARI will go to the destination selected by the user
    $("#confirm-yes").on("click", function() {
        console.log("Decisione confermata per: " + page_manager.selectedDestinationRosName);
        
        // Send the destination to the path planner node
        page_manager.common_demo.sendSmartNav(page_manager.selectedDestinationRosName);
        
        page_manager.common_demo.say("Okay, let's go!");

        page_manager.isWaitingForConfirmation = false;
        
        $("#confirmation-modal").fadeOut(300);
    });

    $("#dock-btn").on("click", function() {
        // check whether ARI is charging or not and changes the dock/undock action to send accordingly. 
        // This action is handled by the same node that performes path planning
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