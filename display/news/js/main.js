
// list of gestures that ARI will do while talking. They are not included in the demo, so
// I had to build them in the WebGUI
const GESTURES = ['dialogue_gesture_1', 'dialogue_gesture_2', 'dialogue_gesture_3'];

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
            console.log('ROS connected on ' + this.url);

            // Creation of a CommonDemoARI object to initializate the common logic in the whole project,
            // which is defined in the file ../tools/js/core.js
            this.common_demo = new CommonDemoARI({
                ros: this.ros
            });

            // Subscription to the motion topic, useful to make movements and all the interactions
            this.playMotionTopic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/play_motion/goal',
                messageType: 'play_motion_msgs/PlayMotionActionGoal'
            });

            this.init();
        });

        this.ros.on('error', (error) => {
            console.error('ROS Error:', error);
        });
    }

    // Function to execute animations
  	playAnimation(motionName){

    	console.log("Sending animation: " + motionName);

		// Publishment of the desired motion on ARI's channel to execute the animation
    	this.playMotionTopic.publish({
      		goal: {
        		motion_name: motionName,
        		skip_planning: true
      		}
    	});

  	}

    init() {
        this.common_demo.init(() => {
            console.log("CommonDemoARI ready");
            if (typeof window.setupSpeech === 'function') {
                window.setupSpeech();
            }
        });
    }

    // function to make ARI execute one random gesture between the ones that are in the list defined previously
    playRandomGesture() {

        const randomIndex = Math.floor(Math.random() * GESTURES.length);
        const selectedGesture = GESTURES[randomIndex];
        this.playAnimation(selectedGesture);

    }
}

$(document).ready(function() {

    const page_manager = new PageManager();
    let moveInterval = null; 

    // Back button navigation, making sure that, if we are in the page of the detail of one news, it 
    // will go back to the list page, otherwise it will go back to the main menu
    $(".control-btn[title='Back']").on("click", function() {

        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('id')) window.location.href = 'index.html';
        else window.location.href = "../unitn_main_menu/index.html";

    });

    // Home button navigation
    $(".control-btn[title='Home']").on("click", function() {

        window.location.href = "../unitn_main_menu/index.html";

    });

    // fetching of the news, which are in the file located in ../tools/assets/news.json This file is
    // filled by a python script, which is ../pythons_scripts/update_news.py To update the news,
    // it is needed to run the script locally, which will fetch the data from the UniTrento website
    // and then write them in the news.json file. Though, I had some difficulties fetching the whole
    // data of the news, so only the title and the date will be shown entirely, while the description of
    // the news will not be shown correctly.
    fetch('../tools/assets/news.json')
        .then(response => response.json())
        .then(data => {

            const newsArray = data;
            
            // List rendering, here it is shown a list of all the news, each with a "Read more" button
            // which will go to the detail page of the selected news
            const container = $(".news-container");
            if (container.length) {

                container.empty();

                newsArray.forEach(news => {

                    container.append(`
                        <div class="news-card">
                            <div class="news-date">${news.date}</div>
                            <h3>${news.title}</h3>
                            <p>${news.description}</p>
                            <button class="btn-read-more" onclick="window.location.href='news_detail.html?id=${news.id}'">Read more</button>
                        </div>`);
                });

            }

            // News detail rendering
            const urlParams = new URLSearchParams(window.location.search);
            const newsId = urlParams.get('id');
            
            if (newsId) {

                const currentNews = newsArray.find(n => n.id === newsId);

                if (currentNews) {

                    $("#detail-title").text(currentNews.title);
                    $("#detail-date").text(currentNews.date);
                    $("#detail-text").text(currentNews.content);
                    
                    // function that will make ARI read the news while doing some gestures
                    window.setupSpeech = function() {
                        $("#ari-read-btn").off("click").on("click", function() {

                            if (moveInterval) clearInterval(moveInterval);

                            const speech = "Sure! Here is the news. " + currentNews.title + ". " + currentNews.content;
                            
                            // ARI talks
                            page_manager.common_demo.say(speech);

                            // Estimated duration of the reading
                            const estimatedDurationMs = (speech.length / 15) * 1000;
                            console.log("Estimated reading duration: " + (estimatedDurationMs/1000).toFixed(1) + " seconds");

                            // ARI makes random gestures, it starts immediately
                            page_manager.playRandomGesture();

                            // computation of the start time, useful to understand how much time is left
                            // to read the entire news
                            let startTime = Date.now();

                            //we set ARI to make a gesture once every 8 seconds until the estimated time
                            // has been reached
                            moveInterval = setInterval(() => {
                                let elapsed = Date.now() - startTime;
                                
                                // It keeps moving only if the estimated duration has not been reached yet
                                if (elapsed < estimatedDurationMs) {
                                    page_manager.playRandomGesture();
                                } else {
                                    console.log("End of the estimated duration, stopping the gestures.");
                                    clearInterval(moveInterval);
                                    page_manager.playAnimation('nod');
                                }
                            }, 8000); // a gesture every 8 seconds
                        });
                    };
                    
                    if (page_manager.common_demo && page_manager.common_demo.is_initialized) {
                        window.setupSpeech();
                    }

                }

            }

        });

});