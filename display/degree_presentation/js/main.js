class PageManager {
  	constructor() {
    	// IP Computation, useful to take tests locally
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.11" 
        //                 : window.location.hostname;
        // this.url = "ws://" + robotIP + ":9090";
       	this.url = "ws://" + window.location.hostname + ":9090";

        this.presentationStarted = false;

    	this.ros = new ROSLIB.Ros({
      		url: this.url
    	});
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

    togglePresentation() {
        const video = $('#degree-presentation-video')[0];
        const icon = $('#play-pause-icon');
        const overlay = $('#video-controls-overlay');
        const config = this.common_demo.config;

        if (video.paused) {
            // --- AZIONE: PLAY ---
            video.play();
            icon.removeClass('fa-circle-play').addClass('fa-circle-pause');
            overlay.css('background', 'rgba(0,0,0,0)'); // Rendi l'overlay trasparente mentre va
            icon.fadeOut(500); // Nascondi l'icona dopo un po'

            // Se è la prima volta che premo Play, ARI parla e fa i gesti
            if (!this.presentationStarted) {
                this.presentationStarted = true;
                if (config && config.degree_presentation.intro_text) {
                    this.common_demo.say(config.degree_presentation.intro_text);
                }
            }
        } else {
            // --- AZIONE: PAUSA ---
            video.pause();
            icon.removeClass('fa-circle-pause').addClass('fa-circle-play');
            overlay.css('background', 'rgba(0,0,0,0.3)');
            icon.show();
            console.log("Presentazione in pausa.");
        }
    }

  	init() {

    	this.common_demo.init(() => {

			const config = this.common_demo.config;

			console.log("ARI pronto con configurazione caricata.");

            if (config) {
				const fullVideoPath = "../tools/assets/" + config.degree_presentation.video_path;
				$('#video-source').attr('src', fullVideoPath);
        		$('#degree-presentation-video')[0].load();
            }

    });
  }
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	$("#video-controls-overlay").on("click", function() {
        page_manager.togglePresentation();
    });

    // Se vuoi che l'icona riappaia se l'utente passa sopra il video (opzionale)
    $("#video-controls-overlay").on("mouseenter", function() {
        if (!$('#degree-presentation-video')[0].paused) {
            $('#play-pause-icon').fadeIn(200);
        }
    }).on("mouseleave", function() {
        if (!$('#degree-presentation-video')[0].paused) {
            $('#play-pause-icon').fadeOut(200);
        }
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