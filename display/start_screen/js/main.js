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
    	  	console.log('ROS connected on' + this.url);
      
			// Creation of a CommonDemoARI object to initializate the common logic in the whole project,
            // which is defined in the file ../tools/js/core.js
      		this.common_demo = new CommonDemoARI({
        		ros: this.ros
      		});

      		this.init();
    	});

    	this.ros.on('error', (error) => {
      		console.error('ROS error:', error);
    	});
  	}

  	init(){
    	this.common_demo.init(() => {

    	});
  	}
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// When any part of the screen will be clicked, the application will start by navigating to 
  	// the main menu
  	$(".main-container").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

});