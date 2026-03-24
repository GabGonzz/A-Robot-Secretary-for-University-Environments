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

        if (video.paused) {
            // --- AZIONE: PLAY ---
            video.play();
            icon.removeClass('fa-circle-play').addClass('fa-circle-pause');
            overlay.css('background', 'rgba(0,0,0,0)');
            icon.fadeOut(500);

            // AVVIA I GESTI
            this.startVideoGestures();

        } else {
            // --- AZIONE: PAUSA ---
            video.pause();
            icon.removeClass('fa-circle-pause').addClass('fa-circle-play');
            overlay.css('background', 'rgba(0,0,0,0.3)');
            icon.show();

            // FERMA I GESTI
            this.stopVideoGestures();
        }
    }

    // Aggiungi questi metodi alla tua classe PageManager
    startVideoGestures() {
        // Evitiamo di sovrapporre più intervalli
        if (this.moveInterval) clearInterval(this.moveInterval);

        console.log("ARI inizia a gesticolare per il video.");
        
        // Esegue il primo gesto immediatamente
        this.playRandomGesture();

        // Imposta il loop: un gesto ogni 8 secondi (puoi ridurlo a 6s se vuoi ARI più attivo)
        this.moveInterval = setInterval(() => {
            const video = $('#degree-presentation-video')[0];
            
            // Verifichiamo di nuovo se il video è in pausa (sicurezza extra)
            if (video && !video.paused && !video.ended) {
                this.playRandomGesture();
            } else {
                this.stopVideoGestures();
            }
        }, 9000); 
    }

    stopVideoGestures() {
        console.log("ARI torna in posizione di riposo.");
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        // Riporta ARI in una posizione neutra
        this.playAnimation('start_ari');
    }

    // function to make ARI execute one random gesture between the ones that are in the list defined previously
    playRandomGesture() {
        const gestures = this.common_demo.config.speech.available_gestures;
        const randomIndex = Math.floor(Math.random() * gestures.length);
        const selectedGesture = gestures[randomIndex];
        this.playAnimation(selectedGesture);
    }

    init() {
        this.common_demo.init(() => {
            const config = this.common_demo.config;
            const video = $('#degree-presentation-video')[0];

            if (config && config.degree_presentation) {
                const fullVideoPath = "../tools/assets/" + config.degree_presentation.video_path;
                $('#video-source').attr('src', fullVideoPath);
                video.load();
            }

            // AGGIORNAMENTO BARRA IN TEMPO REALE
            video.addEventListener('timeupdate', () => {
                const percentage = (video.currentTime / video.duration) * 100;
                $('#video-progress-bar').css('width', percentage + '%');
            });

            // RESET QUANDO IL VIDEO FINISCE
            video.addEventListener('ended', () => {
                $('#play-pause-icon').removeClass('fa-circle-pause').addClass('fa-circle-play').show();
                $('#video-controls-overlay').css('background', 'rgba(0,0,0,0.3)');
                $('#video-progress-bar').css('width', '0%');
                this.stopVideoGestures();

                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
            });
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

    $("#video-progress-container").on("click", function(e) {
        const video = $('#degree-presentation-video')[0];
        const container = $(this);
        
        // Calcoliamo la posizione del click rispetto alla larghezza totale della barra
        const clickX = e.pageX - container.offset().left;
        const width = container.width();
        const seekTime = (clickX / width) * video.duration;

        video.currentTime = seekTime;
    });

    // Dentro il tuo $(document).ready
    $("#fullscreen-btn").on("click", function(e) {
        e.stopPropagation();
        const target = document.getElementById('fullscreen-target');
        const icon = $(this).find('i');

        // Controllo compatibile con Tablet (Chrome/Safari)
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

        if (!isFullscreen) {
            // Entra in Fullscreen
            if (target.requestFullscreen) {
                target.requestFullscreen();
            } else if (target.webkitRequestFullscreen) { // Safari/iOS
                target.webkitRequestFullscreen();
            }
            icon.removeClass('fa-expand').addClass('fa-compress');
        } else {
            // Esci dal Fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            icon.removeClass('fa-compress').addClass('fa-expand');
        }
    });

    // Listener per gestire il tasto "ESC" e aggiornare l'icona correttamente
    document.addEventListener('fullscreenchange', () => {
        const icon = $("#fullscreen-btn i");
        if (!document.fullscreenElement) {
            icon.removeClass('fa-compress').addClass('fa-expand');
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