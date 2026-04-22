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
            this.viewer.scaleToDimensions(grid.width, grid.height);
            this.viewer.shift(grid.pose.position.x, grid.pose.position.y);
            this.baseScale = stage.scaleX;

            let isDragging = false;

            // Pulizia listener precedenti
            stage.off("stagemousedown");
            stage.off("stagemousemove");
            stage.off("stagemouseup");

            // L'evento "pressmove" è molto più reattivo per il trascinamento su touchscreen
            stage.on("stagemousedown", (e) => {
                isDragging = false;
                this.offset = { 
                    stageX: stage.x, 
                    stageY: stage.y,
                    mouseX: e.stageX,
                    mouseY: e.stageY
                };
                console.log(`[DEBUG-TOUCH] Down rilevato a: ${e.stageX}, ${e.stageY}`);
            });

            stage.on("stagemousemove", (e) => {
                if (this.offset) {
                    let dx = e.stageX - this.offset.mouseX;
                    let dy = e.stageY - this.offset.mouseY;

                    // DEBUG: Vediamo se il browser manda dati mentre muovi il dito
                    // Usiamo un contatore o stampiamo ogni tanto per non intasare la console
                    if (Math.random() > 0.9) { 
                        console.log(`[DEBUG-TOUCH] Moving... DeltaX: ${dx.toFixed(1)}, DeltaY: ${dy.toFixed(1)}`); 
                    }

                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        if (!isDragging) console.log("[DEBUG-TOUCH] SOGLIA SUPERATA: Inizio trascinamento vero");
                        isDragging = true;
                    }

                    if (isDragging) {
                        let nextX = this.offset.stageX + dx;
                        let nextY = this.offset.stageY + dy;

                        // Calcolo limiti (Boundaries)
                        const mapWidthOnScreen = grid.image.width * stage.scaleX;
                        const mapHeightOnScreen = grid.image.height * stage.scaleY;
                        const screenRegX = stage.regX * stage.scaleX;
                        const screenRegY = stage.regY * stage.scaleY;

                        let maxX = screenRegX + (mapWidthOnScreen - 800); 
                        let minX = screenRegX;
                        let maxY = screenRegY + (mapHeightOnScreen - 600);
                        let minY = screenRegY;

                        if (mapWidthOnScreen > 800) {
                            if (nextX > maxX) nextX = maxX;
                            if (nextX < minX) nextX = minX;
                        }
                        if (mapHeightOnScreen > 600) {
                            if (nextY > maxY) nextY = maxY;
                            if (nextY < minY) nextY = minY;
                        }

                        stage.x = nextX;
                        stage.y = nextY;
                    }
                }
            });

            stage.on("stagemouseup", (event) => {
                if (grid && !isDragging && this.offset) {
                    const pos = grid.globalToLocal(event.stageX, event.stageY);
                    
                    if (pos.x >= 0 && pos.x <= grid.image.width && pos.y >= 0 && pos.y <= grid.image.height) {
                        this.createMarker(event.stageX, event.stageY);
                        this.selectedX = (pos.x * grid.scaleX) + grid.x;
                        this.selectedY = -( (pos.y * grid.scaleY) + grid.y );
                        console.log(`x: ${this.selectedX} y: ${this.selectedY}`)
                        this.showConfirmation("this point on the map");
                    }
                }
                this.offset = null;
            });
        });
    }

    zoom(factor) {
        this.zoomLevel *= factor;
        if(this.zoomLevel < 0.5) this.zoomLevel = 0.5;
        if(this.zoomLevel > 5.0) this.zoomLevel = 5.0;

        const newScale = this.baseScale * this.zoomLevel;
        this.viewer.scene.scaleX = newScale;
        this.viewer.scene.scaleY = newScale;

        // Se esiste un marker, aggiorniamo la sua scala inversa in tempo reale
        if (this.goalMarker) {
            this.goalMarker.scaleX = 1 / newScale;
            this.goalMarker.scaleY = 1 / newScale;
        }
        
        this.viewer.scene.update();
    }

    createMarker(stageX, stageY) {
        this.removeMarker();

        this.goalMarker = new createjs.Shape();
        
        // Disegniamo il cerchio
        this.goalMarker.graphics
            .setStrokeStyle(2)
            .beginStroke("black")
            .beginFill("#990000")
            .drawCircle(0, 0, 10); // Raggio base
        
        // 1. TRASFORMAZIONE: coordinate corrette nello stage
        let localPos = this.viewer.scene.globalToLocal(stageX, stageY);
        this.goalMarker.x = localPos.x;
        this.goalMarker.y = localPos.y;

        // 2. SCALA INVERSA: Questa è la chiave.
        // Dividiamo 1 per la scala attuale dello stage. 
        // Se lo stage è scalato a 0.1, il marker viene scalato a 10, 
        // annullando l'effetto "gigante".
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