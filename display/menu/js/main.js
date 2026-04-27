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

  	// Navigation to POI page
  	$("#navigation_btn").on("click", function() {

    	window.location.href = "../unitn_navigation_menu/index.html";

  	});

  	// Navigation to the cameras menu page
  	$("#cam_btn").on("click", function() {

    	window.location.href = "../unitn_cam_menu/index.html";

  	});

  	// Navigation to the interactions menu page
  	$("#interactions_btn").on("click", function() {

    	window.location.href = "../unitn_interactions_menu/index.html";

  	});

  	// Navigation to the news page
  	$("#news_btn").on("click", function() {

    	window.location.href = "../unitn_news_list/index.html";

  	});
  
});