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

      this.init(); // Chiama l'init che ora attiverà il parlato
    });

    this.ros.on('error', (error) => {
      console.error('Errore ROS:', error);
    });
  }

  init() {
    this.common_demo.init(() => {
      console.log("CommonDemoARI pronto.");
      // CONTROLLO FONDAMENTALE: 
      // Se nella pagina dei dettagli è stata definita la funzione setupSpeech, la eseguiamo.
      if (typeof window.setupSpeech === 'function') {
        window.setupSpeech();
      }
    });
  }
}


$(document).ready(function() {
    const page_manager = new PageManager();

    // Sostituisci il click del tasto Back con questo:
    $(".control-btn[title='Back']").on("click", function() {
      const urlParams = new URLSearchParams(window.location.search);
    
      // Se abbiamo un ID nell'URL, significa che siamo nel dettaglio, quindi torniamo alla lista
      if (urlParams.has('id')) {
          window.location.href = 'index.html';
      } else {
          // Altrimenti siamo nella lista e torniamo al menu principale
          window.location.href = "../unitn_main_menu/index.html";
      }
    });

    $(".control-btn[title='Home']").on("click", function() {
        window.location.href = "../unitn_main_menu/index.html";
    });
    const newsData = {
        "1": {
            id: "1",
            date: "06 MAR 2026",
            title: "News 1",
            preview: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod...",
            fullText: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        },
        "2": {
            id: "2",
            date: "04 MAR 2026",
            title: "News 2",
            preview: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod...",
            fullText: "Testo completo della seconda news."
        }
    };

    // 2. Rendering Lista (Solo se siamo in index.html)
    const container = $(".news-container");
    if (container.length) {
        container.empty();
        Object.values(newsData).forEach(news => {
            const cardHtml = `
                <div class="news-card">
                    <div class="news-date">${news.date}</div>
                    <h3>${news.title}</h3>
                    <p>${news.preview}</p>
                    <button class="btn-read-more" onclick="window.location.href='news_detail.html?id=${news.id}'">
                        Read more
                    </button>
                </div>`;
            container.append(cardHtml);
        });
    }

    // 3. Rendering Dettaglio (Solo se siamo in news_detail.html)
    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');
    if (newsId && newsData[newsId]) {
        const currentNews = newsData[newsId];
        $("#detail-title").text(currentNews.title);
        $("#detail-date").text(currentNews.date);
        $("#detail-text").text(currentNews.fullText);
        
        window.setupSpeech = function() {
            $("#ari-read-btn").off("click").on("click", function() {
                const speech = "Sure! Here is the news. " + currentNews.title + ". " + currentNews.fullText;
                page_manager.common_demo.say(speech);
            });
        };
    }
});