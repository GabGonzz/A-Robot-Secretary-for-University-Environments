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
            // load the news file path from the configuration file
            const newsPath = "../tools/assets/" + this.common_demo.config.news_file_path;
            
            this.loadNews(newsPath);
        });
    }

    // function to make ARI execute one random gesture between the ones that are in the list defined previously
    playRandomGesture() {

        // load the list of the gestures of ARI
        const gestures = this.common_demo.config.speech.available_gestures;
        
        if (gestures && gestures.length > 0) {
            const randomIndex = Math.floor(Math.random() * gestures.length);
            const selectedGesture = gestures[randomIndex];
            this.playAnimation(selectedGesture);
        } else {
            // if the configuration file fails to load, we play a simple gesture
            this.playAnimation('nod');
        }

    }

    // fetching of the news, which are in the file located in ../tools/assets/news.json This file is
    // filled by a python script, which is ../pythons_scripts/update_news.py To update the news,
    // it is needed to run the script locally, which will fetch the data from the UniTrento website
    // and then write them in the news.json file. Though, I had some difficulties fetching the whole
    // data of the news, so only the title and the date will be shown entirely, while the description of
    // the news will not be shown correctly.
    loadNews(path) {
        fetch(path)
            .then(response => response.json())
            .then(newsArray => {
                // handle of the two different cases: list of news or news details
                const urlParams = new URLSearchParams(window.location.search);
                const newsId = urlParams.get('id');

                if (newsId) {
                    this.renderNewsDetail(newsArray, newsId);
                } else {
                    this.renderNewsList(newsArray);
                }
            })
            .catch(err => console.error("Error loading news:", err));
    }

    // function to display the list of the news
    renderNewsList(newsArray) {
        const container = $(".news-container");
        if (!container.length) return;

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

    // function to display the details of the selected news
    renderNewsDetail(newsArray, newsId) {
        const currentNews = newsArray.find(n => n.id === newsId);
        if (!currentNews) return;

        $("#detail-title").text(currentNews.title);
        $("#detail-date").text(currentNews.date);
        $("#detail-text").text(currentNews.content);

        // handle of the "ARI read the news" button
        $("#ari-read-btn").off("click").on("click", () => {
            this.readNewsWithGestures(currentNews);
        });
    }

    //function to make ARI read the selected news while executing some random gestures 
    // to make it more natural
    readNewsWithGestures(news) {
        if (this.moveInterval) clearInterval(this.moveInterval);

        const speech = "Sure! Here is the news. " + news.title + ". " + news.content;
        this.common_demo.say(speech);

        // computation of the estimated speech time to not make ARI play gestures when the speech will 
        // likely be finished
        const estimatedDurationMs = (speech.length / 15) * 1000;
        this.playRandomGesture();

        let startTime = Date.now();
        this.moveInterval = setInterval(() => {
            let elapsed = Date.now() - startTime;
            if (elapsed < estimatedDurationMs) {
                this.playRandomGesture();
            } else {
                clearInterval(this.moveInterval);
                this.playAnimation('nod');
            }
        }, 9000);
    }

}

$(document).ready(function() {

    const page_manager = new PageManager();

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

});