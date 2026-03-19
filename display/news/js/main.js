const GESTURES = ['dialogue_gesture_1', 'dialogue_gesture_2', 'dialogue_gesture_3'];

class PageManager {
    constructor() {
        const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
                        ? "10.160.50.11" 
                        : window.location.hostname;

        this.url = "ws://" + robotIP + ":9090";
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
            console.log("CommonDemoARI pronto.");
            if (typeof window.setupSpeech === 'function') {
                window.setupSpeech();
            }
        });
    }

    playRandomGesture() {
        const randomIndex = Math.floor(Math.random() * GESTURES.length);
        const selectedGesture = GESTURES[randomIndex];
        this.playAnimation(selectedGesture);
    }
}

$(document).ready(function() {
    const page_manager = new PageManager();
    let moveInterval = null; 

    // Gestione navigazione (Back/Home) - Invariata
    $(".control-btn[title='Back']").on("click", function() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('id')) window.location.href = 'index.html';
        else window.location.href = "../unitn_main_menu/index.html";
    });
    $(".control-btn[title='Home']").on("click", function() {
        window.location.href = "../unitn_main_menu/index.html";
    });

    fetch('../tools/assets/news.json')
        .then(response => response.json())
        .then(data => {
            const newsArray = data;
            
            // Rendering Lista (Invariato)
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

            // Rendering Dettaglio
            const urlParams = new URLSearchParams(window.location.search);
            const newsId = urlParams.get('id');
            
            if (newsId) {
                const currentNews = newsArray.find(n => n.id === newsId);
                if (currentNews) {
                    $("#detail-title").text(currentNews.title);
                    $("#detail-date").text(currentNews.date);
                    $("#detail-text").text(currentNews.content);
                    
                    window.setupSpeech = function() {
                        $("#ari-read-btn").off("click").on("click", function() {
                            if (moveInterval) clearInterval(moveInterval);

                            const speech = "Sure! Here is the news. " + currentNews.title + ". " + currentNews.content;
                            
                            // 1. ARI PARLA (Senza callback per evitare blocchi)
                            page_manager.common_demo.say(speech);

                            // 2. CALCOLO DURATA (Stima: 1 secondo ogni 15 caratteri)
                            const estimatedDurationMs = (speech.length / 15) * 1000;
                            console.log("Durata stimata parlato: " + (estimatedDurationMs/1000).toFixed(1) + " secondi");

                            // 3. GESTI CASUALI
                            page_manager.playRandomGesture(); // Primo gesto subito

                            let startTime = Date.now();
                            moveInterval = setInterval(() => {
                                let elapsed = Date.now() - startTime;
                                
                                // Continua a muoverti solo se non è passato il tempo stimato
                                if (elapsed < estimatedDurationMs) {
                                    page_manager.playRandomGesture();
                                } else {
                                    console.log("Fine tempo stimato, fermo i gesti.");
                                    clearInterval(moveInterval);
                                    page_manager.playAnimation('nod'); // Gesto finale di chiusura
                                }
                            }, 5000); // Un gesto ogni 5 secondi
                        });
                    };
                    
                    if (page_manager.common_demo && page_manager.common_demo.is_initialized) {
                        window.setupSpeech();
                    }
                }
            }
        });
});