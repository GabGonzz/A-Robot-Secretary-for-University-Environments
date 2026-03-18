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
    });
  }
}


$(document).ready(function() {

  const page_manager = new PageManager();

  // Navigation to the speech menu
  $("#speech_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_speech_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_speech_menu");
    // parent.switchConfig("unitn_speech_menu");
    
    window.location.href = "../unitn_speech_menu/index.html";
  });

  $("#present_btn").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("unitn_speech_menu");
    // page_manager.common_demo.sendRobotIntentInput("unitn_speech_menu");
    // parent.switchConfig("unitn_speech_menu");
    
    window.location.href = "../unitn_room_presentation/index.html";
  });

    // --- Interazione Stretta di Mano ---
  $("#shake_hand_btn").on("click", function() {
    console.log("Richiesta stretta di mano (Shake Left)...");
    
    // Su ARI, l'animazione standard si chiama spesso 'handshake'
    // Se hai un'animazione custom, sostituisci il nome qui sotto
    page_manager.playAnimation('shake_left');
    setTimeout(() => {
        page_manager.common_demo.say("Nice to meet you! I am ARI.");
      }, 1000);
  });

  $("#high_five_btn").on("click", function() {
    console.log("Richiesta high five...");
    
    // Su ARI, l'animazione standard si chiama spesso 'handshake'
    // Se hai un'animazione custom, sostituisci il nome qui sotto
    page_manager.playAnimation('high_five');
    setTimeout(() => {
        page_manager.common_demo.say("Give me an high five!");
      }, 2000);
  });

  $("#show_left_btn").on("click", function() {
    console.log("Esecuzione Show Left...");
    page_manager.playAnimation('show_left');
    page_manager.common_demo.say("Please, take a look at the area on my left.");
  });

  // --- Interazione Show Right ---
  $("#show_right_btn").on("click", function() {
    console.log("Esecuzione Show Right...");
    // Nota: se il gomito destro è ancora in errore, il movimento sarà parziale
    page_manager.playAnimation('show_right');
    page_manager.common_demo.say("And over here on my right, you can find the rest of the lab.");
  });

  $("#look_around_btn").on("click", function() {
    console.log("Esecuzione Look Around...");
    
    // Eseguiamo l'animazione trovata nei rosparam
    page_manager.playAnimation('look_around');
    
    // Feedback vocale opzionale
    page_manager.common_demo.say("Let me take a look at this beautiful place!");
  });

  // Back to the previous screen
  $(".control-btn[title='Back']").on("click", function() {

    // The navigation between the pages is usually handled by some ROS functions, but while
    // working only on the layout these are not usable, so here they are commented
    // page_manager.common_demo.logBack("back_from_interactions_menu");
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

});