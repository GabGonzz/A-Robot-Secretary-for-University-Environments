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

  // When any part of the screen will be clicked, the application will start by navigating to 
  // the main menu
  $(".main-container").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("navigating_to_unitn_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_main_menu");
    // parent.switchConfig("unitn_main_menu");

    window.location.href = "../unitn_main_menu/index.html";
  });
});