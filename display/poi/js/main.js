class PageManager {
  constructor() {
    this.url = "ws://" + window.location.hostname + ":9090";
    this.ros = new ROSLIB.Ros({
      url: this.url
    });
    this.ros.on('connection', () => {
      console.log('Connesso a ROS su ' + this.url);
      
      this.common_demo = new CommonDemoARI({
        ros: this.ros
      });

      this.init();
    });

    this.ros.on('error', (error) => {
      console.error('Errore ROS:', error);
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

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("back_from_poi_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_main_menu");
    // parent.switchConfig("unitn_main_menu");

    window.location.href = "../unitn_main_menu/index.html";
  });

  // Back to the home screen
  $(".control-btn[title='Home']").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("back_to_unitn_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_main_menu");
    // parent.switchConfig("unitn_main_menu");

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