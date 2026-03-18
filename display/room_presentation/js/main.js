class PageManager {
  constructor() {
    const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
                        ? "10.160.50.11" 
                        : window.location.hostname;

        this.url = "ws://" + robotIP + ":9090";
    // this.url = "ws://" + window.location.hostname + ":9090";
    this.ros = new ROSLIB.Ros({
      url: this.url
    });
    this.ros.on('connection', () => {
      console.log('Connesso a ROS su ' + this.url);
      
      this.common_demo = new CommonDemoARI({
        ros: this.ros
      });

      this.playMotionTopic = new ROSLIB.Topic({
        ros: this.ros,
        name: '/play_motion/goal',
        messageType: 'play_motion_msgs/PlayMotionActionGoal'
      });

      this.init();
    });

    this.ros.on('error', (error) => {
      console.error('Errore ROS:', error);
    });
  }

  // Funzione per eseguire un'animazione
  playAnimation(motionName) {
    console.log("Invio mozione: " + motionName);
    this.playMotionTopic.publish({
      goal: {
        motion_name: motionName,
        skip_planning: true
      }
    });
  }

  init() {
    this.common_demo.init(() => {
      this.common_demo.say("Welcome to our laboratory! On the left, you can see the entrance, while throughout room you can observe many different types of robots. Also, on the right, there are many windows to keep this place bright.");

      // 2. Movimento verso DESTRA (Right) - facciamolo partire quasi subito 
      // perché nella frase "Welcome..." ARI attira l'attenzione.
      setTimeout(() => {
        console.log("Animazione: Show Right");
        this.playAnimation('show_right');
      }, 1000); // Parte dopo 1 secondo

      setTimeout(() => {
        console.log("Animazione: Show Left");
        this.playAnimation('show_left');
      }, 10000);


    });
  }
}


$(document).ready(function() {

  const page_manager = new PageManager();

  const video = document.getElementById('room-presentation-video');

  // Assicuriamoci che il video parta (alcuni browser bloccano l'autoplay)
  if (video) {
    video.play().catch(error => {
        console.log("Autoplay bloccato, l'utente deve interagire prima: ", error);
    });
  }

  // Back to the previous screen
  $(".control-btn[title='Back']").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("back_from_interactions_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_main_menu");
    // parent.switchConfig("unitn_main_menu");

    window.location.href = "../unitn_interactions_menu/index.html";
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

});