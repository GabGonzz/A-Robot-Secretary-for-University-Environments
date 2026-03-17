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

  // Navigation to POI page
  $("#poi_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_poi_list");
    // page_manager.common_demo.sendRobotIntentInput("unitn_poi_list");
    // parent.switchConfig("unitn_poi_list");

    window.location.href = "../unitn_poi_list/index.html";
  });

  // Navigation to the Head camera page
  $("#front_cam_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_front_cam");
    // page_manager.common_demo.sendRobotIntentInput("unitn_front_cam");
    // parent.switchConfig("unitn_front_cam");

    window.location.href = "../unitn_front_cam/index.html";
  });

  // Navigation to the torso camera page
  $("#torso_cam_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_torso_cam");
    // page_manager.common_demo.sendRobotIntentInput("unitn_torso_cam");
    // parent.switchConfig("unitn_torso_cam");

    window.location.href = "../unitn_torso_cam/index.html";
  });

  // Navigation to the interactions page
  $("#interactions_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_interactions_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_interactions_menu");
    // parent.switchConfig("unitn_interactions_menu");

    window.location.href = "../unitn_interactions_menu/index.html";
  });

  // Navigation to the news page
  $("#news_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_interactions_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_interactions_menu");
    // parent.switchConfig("unitn_interactions_menu");

    window.location.href = "../unitn_news_list/index.html";
  });
  
});