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

      		this.init();
    	});

    	this.ros.on('error', (error) => {
      		console.error('ROS Error:', error);
    	});
  	}

  	init(){
    	this.common_demo.init(() => {

    	});
  	}
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Navigation to the Head camera page
  	$("#front_cam_btn").on("click", function() {

    	window.location.href = "../unitn_front_cam/index.html";

  	});

  	// Navigation to the torso camera page
  	$("#torso_cam_btn").on("click", function() {

    	window.location.href = "../unitn_torso_cam/index.html";

  	});

  	// Navigation to the interactions page
  	$("#back_cam_btn").on("click", function() {

    	window.location.href = "../unitn_back_cam/index.html";

  	});

    // Navigation to the interactions page
  	$("#front_fisheye_cam_btn").on("click", function() {

    	window.location.href = "../unitn_front_fisheye_cam/index.html";

  	});

    // Navigation to the interactions page
  	$("#rear_fisheye_cam_btn").on("click", function() {

    	window.location.href = "../unitn_rear_fisheye_cam/index.html";

  	});

    // Navigation to the interactions page
  	$("#infra_cam_btn").on("click", function() {

    	window.location.href = "../unitn_infra_cam/index.html";

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