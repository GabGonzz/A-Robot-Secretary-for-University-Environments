class PageManager {
    constructor() {
        // 1. Calcolo dell'IP
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.11" 
        //                 : window.location.hostname;

        // this.url = "ws://" + robotIP + ":9090";
        this.url = "ws://" + window.location.hostname + ":9090";

        // 2. Connessione a ROS (usa ROSLIB perché lo carichi nell'HTML)
        this.ros = new ROSLIB.Ros({
            url: this.url 
        });

        // 3. Evento di connessione
        this.ros.on('connection', () => {
            console.log('*** ROS CONNESSO a ' + this.url + ' ***');
            
            // Inizializziamo la logica comune passando l'oggetto ros
            this.common_demo = new CommonDemoARI({
                ros: this.ros
            });

            this.init();
        });

        this.ros.on('error', (error) => {
            console.error('ERRORE DI CONNESSIONE ROS:', error);
        });
    }

    init() {
        // Inizializziamo il core (volume, log, ecc.)
        this.common_demo.init(() => {
            console.log("CommonDemoARI pronto.");
            this.setupCamera();
        });
    }

    setupCamera() {
        console.log("Avvio sottoscrizione telecamera...");
        const imageTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/torso_front_camera/color/image_raw/compressed',
            messageType: 'sensor_msgs/CompressedImage'
        });

        imageTopic.subscribe((message) => {
            const img = document.getElementById('camera-feed');
            if (img) {
                img.src = "data:image/jpeg;base64," + message.data;
            }
        });
    }
}

$(document).ready(() => {
    const page_manager = new PageManager();
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