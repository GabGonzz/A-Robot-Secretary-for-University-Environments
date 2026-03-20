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
  	}

  	init() {
    	this.common_demo.init(() => {

    	});
  	}
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

  	// Logic to acknowledge to which point of interest the user wants to go, currently only
  	// consisting of some mock buttons, later the implementation will be working
  	$("#poi_1, #poi_2, #poi_3").on("click", function() {

        // retrieve the name of the destination to confirm if the user really wants to go there
        let destination = $(this).text();
        $("#modal-text").text("Do you want to go to " + destination + "?");
        
        $("#confirmation-modal").fadeIn(300);
    });

    // If the user cancels the decision, the pop-up disappears
    $("#confirm-no").on("click", function() {
        $("#confirmation-modal").fadeOut(300);
    });

    // If the user confirms the decision, ARI will go to the destination with the user, however, currently
    // the pop-up just disappears, later the logic will be implemented
    $("#confirm-yes").on("click", function() {
        console.log("Confirm decision");
        $("#confirmation-modal").fadeOut(300);
    });

});