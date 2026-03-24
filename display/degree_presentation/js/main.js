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

    //function to play/pause the video and make ARI do gestures while the video plays
    togglePresentation() {
        const video = $('#degree-presentation-video')[0];
        const icon = $('#play-pause-icon');
        const overlay = $('#video-controls-overlay');

        if (video.paused) {
            // if the video was paused, it resumes
            video.play();
            icon.removeClass('fa-circle-play').addClass('fa-circle-pause');
            overlay.css('background', 'rgba(0,0,0,0)');
            icon.fadeOut(500);

            // when the video starts/resumes, ARI will begin to make some gestures
            this.startVideoGestures();

        } else {
            // if the video was playing, it stops
            video.pause();
            icon.removeClass('fa-circle-pause').addClass('fa-circle-play');
            overlay.css('background', 'rgba(0,0,0,0.3)');
            icon.show();

            // we stop ARI from making gestures when the video is paused
            this.stopVideoGestures();
        }
    }

    // function to handle ARI's gestures
    startVideoGestures() {
        // if to avoid the sovrapposition of more intervals
        if (this.moveInterval) clearInterval(this.moveInterval);

        console.log("ARI inizia a gesticolare per il video.");
        
        // it plays the first gesture immediately
        this.playRandomGesture();

        // then, it will play a random gesture each 9 seconds
        this.moveInterval = setInterval(() => {
            const video = $('#degree-presentation-video')[0];
            
            if (video && !video.paused && !video.ended) {
                this.playRandomGesture();
            } else {
                this.stopVideoGestures();
            }
        }, 9000); 
    }

    //function to stop ARI from playing gestures if the video is paused
    stopVideoGestures() {
        console.log("ARI torna in posizione di riposo.");
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        // take ARI back to the normal position
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

            //computation of the video path which is defined partially in the configuration file
            if (config && config.degree_presentation) {
                const fullVideoPath = "../tools/assets/" + config.degree_presentation.video_path;
                $('#video-source').attr('src', fullVideoPath);
                video.load();
            }

            // continuous update of the video progress bar
            video.addEventListener('timeupdate', () => {
                const percentage = (video.currentTime / video.duration) * 100;
                $('#video-progress-bar').css('width', percentage + '%');
            });

            // when the video ends, it resets from the start and it will stop ARI's gestures
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

    // event to play/pause the video on the user's click
  	$("#video-controls-overlay").on("click", function() {
        page_manager.togglePresentation();
    });

    // show the play/pause button when the mouse is on the video
    $("#video-controls-overlay").on("mouseenter", function() {
        if (!$('#degree-presentation-video')[0].paused) {
            $('#play-pause-icon').fadeIn(200);
        }
    }).on("mouseleave", function() {
        if (!$('#degree-presentation-video')[0].paused) {
            $('#play-pause-icon').fadeOut(200);
        }
    });

    // event to go to the instant of the video that is selected by clicking on the progress bar
    $("#video-progress-container").on("click", function(e) {
        const video = $('#degree-presentation-video')[0];
        const container = $(this);
        
        // computation of the click position with respect of the width of the progress bar
        const clickX = e.pageX - container.offset().left;
        const width = container.width();
        const seekTime = (clickX / width) * video.duration;

        video.currentTime = seekTime;
    });

    // fullscreen button event handler, for many types of browsers
    $("#fullscreen-btn").on("click", function(e) {
        e.stopPropagation();
        const target = document.getElementById('fullscreen-target');
        const icon = $(this).find('i');

        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

        if (!isFullscreen) {
            // enter full screen mode
            if (target.requestFullscreen) {
                target.requestFullscreen();
            } else if (target.webkitRequestFullscreen) {
                target.webkitRequestFullscreen();
            }
            icon.removeClass('fa-expand').addClass('fa-compress');
        } else {
            // exit fullscreen mode
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            icon.removeClass('fa-compress').addClass('fa-expand');
        }
    });

    // handler to change the fullscreen button icon when it exits fullscreen mode
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