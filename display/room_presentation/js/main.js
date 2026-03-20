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

  	init() {
    	this.common_demo.init(() => {

			// ARI starts speaking immediately, since the video will play immediately too
      		this.common_demo.say("Welcome to our laboratory! On the left, you can see the entrance, while throughout room you can observe many different types of robots. Also, on the right, there are many windows to keep this place bright.");

      		// we make ARI show the right, since it is the part of the laboratory that will be shown 
			// first. The movement starts after one second, to synchronize it with the video.
      		setTimeout(() => {
        		this.playAnimation('show_right');
      		}, 1000);

			// Then, we make ARI show the left part after 10 seconds, to synchronize it with the video
      		setTimeout(() => {
        	this.playAnimation('show_left');
      		}, 10000);


    });
  }
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	const video = document.getElementById('room-presentation-video');

  	// we make sure that the video has started
  	if (video) {
    	video.play().catch(error => {
        	console.log("Autoplay blocked: ", error);
    	});
  	}

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_interactions_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

});