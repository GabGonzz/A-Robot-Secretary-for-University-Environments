class PageManager{
    constructor(){
        // IP Computation, useful to take tests locally
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.11" 
        //                 : window.location.hostname;
        // this.url = "ws://" + robotIP + ":9090";
        this.url = "ws://" + window.location.hostname + ":9090";
      
        this.ros = new ROSLIB.Ros({
            url: this.url
        });

        // connection to ROS
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
      		console.error('ROS error:', error);
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

  	init(){
    	this.common_demo.init(() => {

    	});
  	}
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Navigation to the speech menu
  	$("#speech_btn").on("click", function() {
    
    	window.location.href = "../unitn_speech_menu/index.html";

  	});

	// navigation to the room presentation page
  	$("#present_room_btn").on("click", function() {
    
    	window.location.href = "../unitn_room_presentation/index.html";

  	});

	// navigation to the degree presentation page
  	$("#present_degree_btn").on("click", function() {
    
    	window.location.href = "../unitn_degree_presentation/index.html";

  	});

    // handshake interaction
  	$("#shake_hand_btn").on("click", function() {

    	page_manager.playAnimation('shake_left');

		// we set the dialogue to start one second after the beginning of the animation, 
		// to make it more natural
    	setTimeout(() => {
        	page_manager.common_demo.say("Nice to meet you! I am ARI.");
      	}, 1000);

  	});

	// high five interaction, not found in ARI's default animation, created by me
  	$("#high_five_btn").on("click", function() {

    	page_manager.playAnimation('high_five');

		// we set the dialogue to start two seconds after the beginning of the animation, 
		// to make it more natural
    	setTimeout(() => {
        	page_manager.common_demo.say("Give me an high five!");
      	}, 2000);

  	});

	//wave interaction with the left hand, not found in ARI's default animation, created by me, since
	// there is a wave interaction with the right hand, but on our ARI the right arm does 
	// not work properly
  	$("#wave_btn").on("click", function() {

    	page_manager.playAnimation('wave_left');

		// we set the dialogue to start two seconds after the beginning of the animation, 
		// to make it more natural
    	setTimeout(() => {
        	page_manager.common_demo.say("Hello! How are you?");
      	}, 2000);

  	});

	// look around interaction
  	$("#look_around_btn").on("click", function() {
		
    	page_manager.playAnimation('look_around');
    	page_manager.common_demo.say("Let me take a look at this place!");

  	});

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

});