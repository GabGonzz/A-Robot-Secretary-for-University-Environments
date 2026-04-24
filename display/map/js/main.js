class PageManager{
 	constructor(){
    	// IP Computation, useful to take tests locally
        // const robotIP = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
        //                 ? "10.160.50.16" 
        //                 : window.location.hostname;
        // this.url = "ws://" + robotIP + ":9090";
        this.url = "ws://" + window.location.hostname + ":9090";
    	this.ros = new ROSLIB.Ros({
      		url: this.url
    	});

    	this.ros.on('connection', () => {
            console.log('Connesso a ROS su ' + this.url);
        
            // Creation of a CommonDemoARI object to initializate the common logic in the whole project,
            // which is defined in the file ../tools/js/core.js
            this.common_demo = new CommonDemoARI({
                ros: this.ros
            });

            this.init();
            this.initMap();
    	});

    	this.ros.on('error', (error) => {
      		console.error('ROS Error:', error);
    	});

        this.selectedX = 0;
        this.selectedY = 0;

        this.zoomLevel = 1.0;

        this.goalMarker = null;

  	}

    initMap() {
        this.viewer = new ROS2D.Viewer({
            divID: 'map-canvas',
            width: 800, // Dimensione fissa del viewer
            height: 600
        });

        let stage = this.viewer.scene;
        createjs.Touch.enable(this.viewer.scene);
        stage.preventSelection = true;

        this.navMap = new ROS2D.OccupancyGridClient({
            ros: this.ros,
            rootObject: stage,
            continuous: true,
            topic: '/map'
        });

        this.navMap.on('change', () => {
            const grid = this.navMap.currentGrid;
            const stage = this.viewer.scene;

            // Inizializzazione standard ROS
            this.viewer.scaleToDimensions(grid.width, grid.height);
            this.viewer.shift(grid.pose.position.x, grid.pose.position.y);
            this.baseScale = stage.scaleX;

            // Salviamo le coordinate originarie perfette a zoom 1.0
            this.baseX = stage.x;
            this.baseY = stage.y;

            // FONDAMENTALE: Calcoliamo il Bounding Box originale a Zoom 1.0
            // Questo traccia esattamente dove si trovano i 4 bordi della mappa sullo schermo
            let ptTL = grid.localToGlobal(0, 0);
            let ptBR = grid.localToGlobal(grid.image.width, grid.image.height);
            this.baseMapLeft = Math.min(ptTL.x, ptBR.x);
            this.baseMapRight = Math.max(ptTL.x, ptBR.x);
            this.baseMapTop = Math.min(ptTL.y, ptBR.y);
            this.baseMapBottom = Math.max(ptTL.y, ptBR.y);

            // Sincronizziamo subito le ancore della classe
            this.initialStageX = stage.x;
            this.initialStageY = stage.y;

            let isDragging = false;
            let startX, startY;
            const canvasDiv = document.getElementById('map-canvas');
            // Pulizia per sicurezza
            stage.off("stagemousedown");

            canvasDiv.addEventListener('touchstart', (e) => {
                isDragging = false;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                
                // FONDAMENTALE: registra dove si trova la mappa nel momento in cui la tocchi
                this.initialStageX = stage.x;
                this.initialStageY = stage.y;
            }, { passive: false });

            canvasDiv.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                
                let dx = touch.clientX - startX;
                let dy = touch.clientY - startY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

                if (isDragging) {
                    stage.x = this.initialStageX + dx;
                    stage.y = this.initialStageY + dy;
                    
                    // Applichiamo i confini matematici!
                    this.applyMapBoundaries(stage);
                    
                    stage.update();
                }
            }, { passive: false });

            canvasDiv.addEventListener('touchend', (e) => {
                if (!isDragging) {
                    const touch = e.changedTouches[0];
                    const rect = canvasDiv.getBoundingClientRect();
                    
                    // Coordinate del tocco rispetto al div
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    // Coordinate globali dello stage
                    const stageX = x * (canvasDiv.children[0].width / rect.width);
                    const stageY = y * (canvasDiv.children[0].height / rect.height);
                    
                    // Coordinate locali della mappa (corrispondono ai pixel dell'immagine)
                    const pos = grid.globalToLocal(stageX, stageY);
                    
                    if (pos.x >= 0 && pos.x <= grid.image.width && pos.y >= 0 && pos.y <= grid.image.height) {
                        
                        // --- INIZIO NUOVA LOGICA DI CONTROLLO COLORE ---
                        // Recuperiamo il contesto 2D del canvas generato da ROS2D
                        const ctx = grid.image.getContext('2d');
                        
                        // Leggiamo i dati del singolo pixel cliccato (1x1 pixel)
                        const pixelData = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
                        
                        // pixelData contiene un array [R, G, B, Alpha]
                        const r = pixelData[0];
                        const g = pixelData[1];
                        const b = pixelData[2];
                        
                        // Consideriamo "spazio libero" solo i pixel molto chiari (Bianco)
                        // Soglia a 240 per tollerare eventuali compressioni d'immagine
                        const isFreeSpace = (r > 240 && g > 240 && b > 240);
                        
                        if (isFreeSpace) {
                            // È bianco! Il robot può andarci
                            this.createMarker(stageX, stageY);
                            this.selectedX = (pos.x * grid.scaleX) + grid.x;
                            this.selectedY = -((pos.y * grid.scaleY) + grid.y);
                            this.showConfirmation("this point on the map");
                        } else {
                            // È grigio o nero! 
                            console.log("[MAPPA] Tap ignorato: Area non navigabile (Ostacolo o Sconosciuto).");
                            
                            // OPZIONALE: Puoi far parlare ARI per avvisare l'utente
                            // this.common_demo.say("I cannot go there.");
                        }
                        // --- FINE NUOVA LOGICA ---
                    }
                }
                isDragging = false;
            }, { passive: false });
        });
    }

    applyMapBoundaries(stage) {
        // Forza lo zoom minimo a 1.0 
        if (this.zoomLevel < 1.0) {
            this.zoomLevel = 1.0;
            stage.scaleX = this.baseScale;
            stage.scaleY = this.baseScale;
        }

        // Se lo zoom è 1.0, blocca rigidamente la mappa nella sua posizione originale
        if (this.zoomLevel === 1.0) {
            stage.x = this.baseX;
            stage.y = this.baseY;
            return;
        }

        const grid = this.navMap.currentGrid;

        // Calcoliamo la posizione globale dei 4 angoli della mappa in questo esatto momento
        let ptTL = grid.localToGlobal(0, 0);
        let ptBR = grid.localToGlobal(grid.image.width, grid.image.height);

        let mapLeft = Math.min(ptTL.x, ptBR.x);
        let mapRight = Math.max(ptTL.x, ptBR.x);
        let mapTop = Math.min(ptTL.y, ptBR.y);
        let mapBottom = Math.max(ptTL.y, ptBR.y);

        // --- CORREZIONE ASSE X ---
        // Se il bordo sinistro è più a destra di quello originale, correggi indietro
        if (mapLeft > this.baseMapLeft) {
            stage.x -= (mapLeft - this.baseMapLeft);
        } 
        // Se il bordo destro è più a sinistra di quello originale, correggi in avanti
        else if (mapRight < this.baseMapRight) {
            stage.x += (this.baseMapRight - mapRight);
        }

        // --- CORREZIONE ASSE Y ---
        // Se il bordo alto scende più giù di quello originale, correggi in su
        if (mapTop > this.baseMapTop) {
            stage.y -= (mapTop - this.baseMapTop);
        } 
        // Se il bordo basso sale più su di quello originale, correggi in giù
        else if (mapBottom < this.baseMapBottom) {
            stage.y += (this.baseMapBottom - mapBottom);
        }
    }

    zoom(factor) {
        this.zoomLevel *= factor;
        
        // Modificato per bloccare lo zoom a 1.0 (evita bordi neri)
        if(this.zoomLevel < 1.0) this.zoomLevel = 1.0;
        if(this.zoomLevel > 5.0) this.zoomLevel = 5.0;

        const newScale = this.baseScale * this.zoomLevel;
        this.viewer.scene.scaleX = newScale;
        this.viewer.scene.scaleY = newScale;

        // Riapplica i confini per ricentrare automaticamente la mappa se stiamo "zoomando indietro"
        this.applyMapBoundaries(this.viewer.scene);

        this.initialStageX = this.viewer.scene.x;
        this.initialStageY = this.viewer.scene.y;

        if (this.goalMarker) {
            this.goalMarker.scaleX = 1 / newScale;
            this.goalMarker.scaleY = 1 / newScale;
        }
        
        this.viewer.scene.update();
    }

    createMarker(stageX, stageY) {
        this.removeMarker();

        this.goalMarker = new createjs.Shape();
        this.goalMarker.graphics
            .setStrokeStyle(2)
            .beginStroke("black")
            .beginFill("#990000")
            .drawCircle(0, 0, 10);
        
        // Convertiamo le coordinate stage (globali del canvas) in coordinate locali dello stage
        // Questo compensa shift, rotazioni o zoom applicati al viewer
        let localPos = this.viewer.scene.globalToLocal(stageX, stageY);
        this.goalMarker.x = localPos.x;
        this.goalMarker.y = localPos.y;

        const currentScale = this.viewer.scene.scaleX;
        this.goalMarker.scaleX = 1 / currentScale;
        this.goalMarker.scaleY = 1 / currentScale;

        this.viewer.scene.addChild(this.goalMarker);
        this.viewer.scene.update(); 
    }

    removeMarker() {
        if (this.goalMarker) {
            console.log("[DEBUG] Rimozoine marker esistente.");
            this.viewer.scene.removeChild(this.goalMarker);
            this.goalMarker = null;
            this.viewer.scene.update();
        }
    }

  	init() {
    	this.common_demo.init(() => {
            const config = this.common_demo.config;
            this.startDockStatusWatcher();

            this.common_demo.subscribeToCalibration((msg) => {
                
            });
    	});
  	}

    showConfirmation(destination) {
        $("#modal-text").text("Do you want to go to " + destination + "?");
        $("#confirmation-modal").fadeIn(300);
        this.common_demo.say("Do you want to go to " + destination + "?");
    }

    // Funzione per monitorare lo stato di ricarica e aggiornare il testo/stile del bottone
    startDockStatusWatcher() {
        // Poiché core.js aggiorna common_demo.isCharging, controlliamo periodicamente
        setInterval(() => {
            const btn = $("#dock-btn");
            const isCharging = this.common_demo.isCharging; // Verificato dal topic /power/is_charging

            if (isCharging) {
                btn.html('<i class="fa-solid fa-plug-circle-minus"></i> UNDOCK');
                btn.removeClass("dock-state-off").addClass("dock-state-on");
            } else {
                btn.html('<i class="fa-solid fa-plug-circle-bolt"></i> DOCK ARI');
                btn.removeClass("dock-state-on").addClass("dock-state-off");
            }
        }, 500); // Aggiorna ogni mezzo secondo
    }

    watchGoalStatus() {
        // Se c'è già un ascoltatore attivo, lo chiudiamo prima di aprirne uno nuovo
        if (this.statusListener) {
            this.statusListener.unsubscribe();
        }

        this.statusListener = new ROSLIB.Topic({
            ros: this.ros,
            name: '/move_base/status',
            messageType: 'actionlib_msgs/GoalStatusArray'
        });

        this.statusListener.subscribe((msg) => {
            if (msg.status_list.length > 0) {
                // Prendiamo lo stato dell'ultimo goal inviato
                const status = msg.status_list[msg.status_list.length - 1].status;
                
                // 3 = SUCCEEDED, 4 = ABORTED, 5 = REJECTED
                if (status === 3 || status === 4 || status === 5) {
                    console.log("Navigazione terminata con stato:", status);
                    this.removeMarker();
                    this.statusListener.unsubscribe();
                    this.statusListener = null;
                }
            }
        });
    }
}


$(document).ready(function() {

  	const page_manager = new PageManager();

  	// Back to the previous screen
  	$(".control-btn[title='Back']").on("click", function() {

    	window.location.href = "../unitn_navigation_menu/index.html";

  	});

  	// Back to the home screen
  	$(".control-btn[title='Home']").on("click", function() {

    	window.location.href = "../unitn_main_menu/index.html";

  	});

    // If the user cancels the decision, the pop-up disappears
    $("#confirm-no").on("click", function() {
        $("#confirmation-modal").fadeOut(300);
        page_manager.removeMarker();
    });

    // If the user confirms the decision, ARI will go to the destination with the user, however, currently
    // the pop-up just disappears, later the logic will be implemented
    $("#confirm-yes").on("click", function() {
        const coords = {
            x: page_manager.selectedX,
            y: page_manager.selectedY
        };
        
        // Pubblica sul topic che il tuo nodo Python ascolta
        page_manager.common_demo.sendSmartNav(JSON.stringify(coords));
        
        // Ascolta lo stato per rimuoverlo
        page_manager.watchGoalStatus();
        
        page_manager.common_demo.say("Path calculated. Moving through calibration points.");
        $("#confirmation-modal").fadeOut(300);
    });

    $("#dock-btn").on("click", function() {
        // Usiamo la variabile isCharging gestita dal core.js
        if (page_manager.common_demo.isCharging) {
            console.log("Invio UNDOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("UNDOCK_MANUAL");
            page_manager.common_demo.say("I am undocking, please stand back.");
        } else {
            console.log("Invio DOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("DOCK_MANUAL");
            page_manager.common_demo.say("I am starting the docking procedure.");
        }
    });

    $("#zoom-in").on("click", () => page_manager.zoom(1.2));

    $("#zoom-out").on("click", () => page_manager.zoom(0.8));

});