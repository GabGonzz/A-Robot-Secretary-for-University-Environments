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

    // Function that creates the map and handles the touch events on it
    initMap() {

        //Create a 2D view on the HTML page that uses the id "map-canvas". 
        // It also defines how much space this view is going to occupy (800x600)
        this.viewer = new ROS2D.Viewer({
            divID: 'map-canvas',
            width: 800,
            height: 600
        });

        // Creation of a stage where there will be added all the graphical elements
        let stage = this.viewer.scene;

        // Enables the touch events on ARI's tablet, without this line all these events would be ignored
        createjs.Touch.enable(this.viewer.scene);

        // Denies the interaction with other graphical elements while the user is interacting with the map
        stage.preventSelection = true;

        // Load the map that ARI sees on the stage by subscribing to the "/map" topic
        this.navMap = new ROS2D.OccupancyGridClient({
            ros: this.ros,
            rootObject: stage,
            continuous: true,
            topic: '/map'
        });

        this.navMap.on('change', () => {

            // Takes the object which contains the data of the map (width, height, etc.)
            const grid = this.navMap.currentGrid;

            // Reference to the graphic scene 
            const stage = this.viewer.scene;

            // Adaptation of the map scale so that the grid will fit on the dimensions seen before (800x600)
            this.viewer.scaleToDimensions(grid.width, grid.height);

            // Since in ROS the origin (0, 0) is not on the top-left corner of the image, but rather on
            // the origin coordinates specified in the map.yaml file, we need to shift the view to make sure
            // that the origin on ROS and the one on canvas will be on the same point
            this.viewer.shift(grid.pose.position.x, grid.pose.position.y);

            // Store the initial scale value to later understand if it has been applied a zoom factor or not
            this.baseScale = stage.scaleX;

            // Store the exact position of the map when it was loaded to have a reference of 
            // how much the user moved on the map compared to the initial position
            this.baseX = stage.x;
            this.baseY = stage.y;

            // computation of the top-left and bottom-right corners of the local map into global 
            // coordinates of the canvas
            let ptTL = grid.localToGlobal(0, 0);
            let ptBR = grid.localToGlobal(grid.image.width, grid.image.height);

            // Computation of the borders of the map, but since ROS could rotate the map, we need 
            // to make sure which are the right values by using the min and max values
            this.baseMapLeft = Math.min(ptTL.x, ptBR.x);
            this.baseMapRight = Math.max(ptTL.x, ptBR.x);
            this.baseMapTop = Math.min(ptTL.y, ptBR.y);
            this.baseMapBottom = Math.max(ptTL.y, ptBR.y);

            // Store the initial values of the map before the movement performed by the user, useful 
            // to later compute the total movement by calculating the difference between the initial and 
            // the final position (the delta)
            this.initialStageX = stage.x;
            this.initialStageY = stage.y;

            // flag to understand if the user is dragging the map
            let isDragging = false;

            // Storage of the point where the user started to move the map
            let startX, startY;

            // Reference of the HTML element to add the listener of the events
            const canvasDiv = document.getElementById('map-canvas');

            // Function to avoid listening to old events by removing them
            stage.off("stagemousedown");

            // Listener that tracks the starting moment of the touch
            canvasDiv.addEventListener('touchstart', (e) => {
                // we reset the dragging flag, since at the start we do not knoww if the user is 
                // performing a simple touch action or a dragging one
                isDragging = false;

                // Considers only the first touch on the screen to store its coordinates 
                // respect to the browser coordinates
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                
                // Storing of the current position of the map 
                this.initialStageX = stage.x;
                this.initialStageY = stage.y;
            }, { passive: false }); // parameter to tell the browser to ignore the events on this area of the HTML to let this code take care of them

            // Handler of the map panning
            canvasDiv.addEventListener('touchmove', (e) => {

                // prevents the browser to perfrom the dafult listener, that would be the scrolling 
                // of the whole page, while we need to handle only the scroll of the map
                e.preventDefault();

                // Takes the current position of the touch and computes the 
                // difference with the initial one, stored in the startX/Y variables
                const touch = e.touches[0];
                let dx = touch.clientX - startX;
                let dy = touch.clientY - startY;

                // Check of the tollerance threshold to distinguish between a 
                // simple touch and a panning, we set the threshold to 5 pixel. 
                // If the check goes through, we set the isDragging flag to true
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

                
                if (isDragging) {
                    // If the user is dragging the image, we need to update the 
                    // coordinates of the map, and we do this by adding the shift 
                    // of the finger (dx/dy) to the initial postiion of the map (initialStageX/Y)
                    stage.x = this.initialStageX + dx;
                    stage.y = this.initialStageY + dy;
                    
                    // Before updating the stage, we need to check if the shift performed moved 
                    // the map outside of the boundaries and block the shift before them if this was the case
                    this.applyMapBoundaries(stage);
                    stage.update();
                }
            }, { passive: false });

            // handler of the realease of the finger off the map, to understand if it was 
            // performed a touch or a dragging action
            canvasDiv.addEventListener('touchend', (e) => {
                // if the user has not dragged the map, we need to know the coordinates of the user's touch
                if (!isDragging) {

                    // we take the data of the first touch
                    const touch = e.changedTouches[0];

                    // The system gives us the coordinates compared to the whole browser's screen, but we 
                    // need to know the position of the finger inside of the map element. To retrieve them, 
                    // we subtract rect.left adn rect.top, so we'll obtain the coordinates with respect to 
                    // the top-left corner of the HTML container
                    const rect = canvasDiv.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    // Since CSS tends to rescale the canvas to enable a better visualization, we need to compute 
                    // a variable that stores the scale between the real size of the canvas' pixel and the viewed size
                    const stageX = x * (canvasDiv.children[0].width / rect.width);
                    const stageY = y * (canvasDiv.children[0].height / rect.height);
                    
                    // Converts the global coordinates of the screen's pixel to local coordinates of the image's pixel
                    const pos = grid.globalToLocal(stageX, stageY);
                    
                    // check if the touch was performed between the image's boundaries, if not, the touch will be ignored
                    if (pos.x >= 0 && pos.x <= grid.image.width && pos.y >= 0 && pos.y <= grid.image.height) {
                        
                        // We take the context of the image to read the color of the selected point. We want to read that 
                        // in order to acknowledge if the touch was performed in a significant area of the map, which is 
                        // represented by a white color, in order to prevent ARI from going to inaccessible areas, 
                        // represented by gray and black colors
                        const ctx = grid.image.getContext('2d');
                        
                        // we read the exact pixel (1x1) that corresponds to the position of the touch. "getImageData" 
                        // takes the exact pixel of the context, then we round it to an integer value and this will 
                        // return a 4 number-array containing the color in a RGBA format
                        const pixelData = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
                        
                        // scomposition of the color in three variables that represents the scale of red, green and blue.
                        const r = pixelData[0];
                        const g = pixelData[1];
                        const b = pixelData[2];
                        
                        // check if the selected point is of a white color, while being tolerant of compression errors 
                        // by setting a 240 value threshold, since white value is 255
                        const isFreeSpace = (r > 240 && g > 240 && b > 240);
                        
                        if (isFreeSpace) {
                            // if the selected point represent a free space on the map, we create a 
                            // marker there to give a visual feedback to the user
                            this.createMarker(stageX, stageY);

                            // convertion of the canvas coordinates in ROS coordinates by multiplying the scale of 
                            // real metres. Also, we need to make sure that the y-value have a "-" in front of it, 
                            // since in the ROS reference system this value grows by going downwards, while in 
                            // canvas' reference system it grows going upwards. These are global variables that  
                            // store the ROS coordinates and will send them to the ROS node that will plan the path 
                            // to the destination when clicking "yes" on the pop-up showed by the 
                            // "showConfirmation" function
                            this.selectedX = (pos.x * grid.scaleX) + grid.x;
                            this.selectedY = -((pos.y * grid.scaleY) + grid.y);
                            this.showConfirmation("this point on the map");
                        } else {
                            // If the spot selected was not accessible, we ignore the touch and send a feedback
                            console.log("[MAPPA] Tap ignorato: Area non navigabile (Ostacolo o Sconosciuto).");

                        }
                    }
                }

                //Lastly, we need to reset the isDragging flag for the next events
                isDragging = false;
            }, { passive: false });
        });
    }

    // Function to apply the boundaries to the map container if the user panned too far on some 
    // direction or if the zoom level has gone below the minimum value
    applyMapBoundaries(stage) {
        // Prevent to make the map more little than the initial size, if this would 
        // not be done, the user would be able to see empty areas
        if (this.zoomLevel < 1.0) {
            this.zoomLevel = 1.0;

            // resets the scale values to the initial ones
            stage.scaleX = this.baseScale;
            stage.scaleY = this.baseScale;
        }

        // If the zoom level is the initial one, it blocks the map to the default position
        // and prevents the panning outside of the boundaries
        if (this.zoomLevel === 1.0) {
            stage.x = this.baseX;
            stage.y = this.baseY;
            return;
        }

        // computation of the current corners's position after the user performed a 
        // zoom/panning action. It converts the local coordinates of the map to the 
        // global coordinates of the canvas. More precisely, it computes the top-left 
        // and the bottom-right corner
        const grid = this.navMap.currentGrid;
        let ptTL = grid.localToGlobal(0, 0);
        let ptBR = grid.localToGlobal(grid.image.width, grid.image.height);

        // Computation of the current position of the map borders relative to the screen. 
        // We use max and min functions because the ROS system could move or rotate the map, 
        // so we need to find the right values
        let mapLeft = Math.min(ptTL.x, ptBR.x);
        let mapRight = Math.max(ptTL.x, ptBR.x);
        let mapTop = Math.min(ptTL.y, ptBR.y);
        let mapBottom = Math.max(ptTL.y, ptBR.y);

        // check if the map has been panned too far on the left, meaning that the position 
        // of the map would go out of the computed boundaries and there would be some black 
        // portion of the screen visible. If that is the case, then we subtract the difference 
        // on the stage.x value to bring back the border in the right boundaries.
        if (mapLeft > this.baseMapLeft) {
            stage.x -= (mapLeft - this.baseMapLeft);
        } 
        // Same check done before, but with a little different logic, that is that we need to 
        // check if the border of the map is too far on the right, so we have to check if the 
        // position of the boundary is smaller of the position of the actual border, meaning 
        // that the border has surpassed the boundary. If that is the case, we need to add 
        // the difference to the stage.x, taking the border back between the boundaries
        else if (mapRight < this.baseMapRight) {
            stage.x += (this.baseMapRight - mapRight);
        }

        // Same check done for the x-axis, but for the top border of the y-axis, while 
        // remembering that the ROS reference system makes the y-value grow downwards, 
        // so we need to perform the check inverting the logic in a normal reference system
        if (mapTop > this.baseMapTop) {
            stage.y -= (mapTop - this.baseMapTop);
        } 
        // Same check done for the top border, but with a different logic for the bottom border
        else if (mapBottom < this.baseMapBottom) {
            stage.y += (this.baseMapBottom - mapBottom);
        }
    }

    // Function to perform zoom on the map
    zoom(factor) {

        // update of the zoom level by the factor parameter given in input
        this.zoomLevel *= factor;
        
        // Checks to see if the zoom level is between the maximum and minimum 
        // boundaries to prevent to make the map too much small/big
        if(this.zoomLevel < 1.0) this.zoomLevel = 1.0;
        if(this.zoomLevel > 5.0) this.zoomLevel = 5.0;

        // Application of the new zoom level to the system, converting the just 
        // computed level in a pixel scale. To accomplish that, we multiply the 
        // zoom level by the base scale that made the map fit in the initial values (800x600 pixels)
        const newScale = this.baseScale * this.zoomLevel;
        this.viewer.scene.scaleX = newScale;
        this.viewer.scene.scaleY = newScale;

        // Application of the map boundaries if the zoom brought the map too 
        // far behind and it would make some portion out of the boundaries visible
        this.applyMapBoundaries(this.viewer.scene);

        // Update of the anchors, so if the user pans the map in some direction, 
        // the system will know where the new position begins
        this.initialStageX = this.viewer.scene.x;
        this.initialStageY = this.viewer.scene.y;

        // If there is a marker on the map, we need to update its size accordingly 
        // to the zoom applied, since it could becomme too big/small relatively to the map
        if (this.goalMarker) {
            this.goalMarker.scaleX = 1 / newScale;
            this.goalMarker.scaleY = 1 / newScale;
        }
        
        // update of the scene with the new parameters
        this.viewer.scene.update();
    }

    // function to create a visual marker on the destination that the user wants to reach
    createMarker(stageX, stageY) {

        // Firstly, we remove the remove the previous marker if it has not been removed yet
        this.removeMarker();

        // Initialization of a new graphical object that will be the marker. We create 
        // it to be a red circle with a black stroke of the right scale relatively to the map
        this.goalMarker = new createjs.Shape();
        this.goalMarker.graphics
            .setStrokeStyle(2)
            .beginStroke("black")
            .beginFill("#990000")
            .drawCircle(0, 0, 10);
        
        // Computation of the local coordinates relative to the scene. We need to convert them 
        // from global, that is relative to the whole page, to local, meaning relative to the 
        // scene (the map image)
        let localPos = this.viewer.scene.globalToLocal(stageX, stageY);
        this.goalMarker.x = localPos.x;
        this.goalMarker.y = localPos.y;

        // Computation of the scale of the newly created marker relatively to the map, since 
        // if this was zoomed, we need to not affect the size of the marker, 
        // rather make it always of the same size
        const currentScale = this.viewer.scene.scaleX;
        this.goalMarker.scaleX = 1 / currentScale;
        this.goalMarker.scaleY = 1 / currentScale;

        // we add the marker to the scene and update it to view it
        this.viewer.scene.addChild(this.goalMarker);
        this.viewer.scene.update(); 
    }

    // function to remove the marker from the scene
    removeMarker() {
        //check if there's a marker on the current scene and, if that is the case, 
        // it removes it and update to a new scene
        if (this.goalMarker) {
            this.viewer.scene.removeChild(this.goalMarker);
            this.goalMarker = null;
            this.viewer.scene.update();
        }
    }

  	init() {
    	this.common_demo.init(() => {
            const config = this.common_demo.config;
            this.startDockStatusWatcher();

            // function to subscribe to the aruco calibration topic and make it run on the background
            this.common_demo.subscribeToCalibration((msg) => {
                
            });
    	});
  	}

    // function to show a confirmation pop-up to see if the user is sure about going to the selected spot
    showConfirmation(destination) {
        $("#modal-text").text("Do you want to go to " + destination + "?");
        $("#confirmation-modal").fadeIn(300);
        this.common_demo.say("Do you want to go to " + destination + "?");
    }

    // Function to check the charge status and monitor the dock action
    startDockStatusWatcher() {
        // we periodically check the value of the isCharging variable that tells us if 
        // ARI is charging or not and shows the button accordingly
        setInterval(() => {
            const btn = $("#dock-btn");
            const isCharging = this.common_demo.isCharging;

            if (isCharging) {
                btn.html('<i class="fa-solid fa-plug-circle-minus"></i> UNDOCK');
                btn.removeClass("dock-state-off").addClass("dock-state-on");
            } else {
                btn.html('<i class="fa-solid fa-plug-circle-bolt"></i> DOCK ARI');
                btn.removeClass("dock-state-on").addClass("dock-state-off");
            }
        }, 500); // Update every half of a second
    }

    // function to check if the navigation goal was successful or not, useful to remove the marker 
    // from the map when the navigation concluded, either succesfully or not
    watchGoalStatus() {
        // If there is already a listener, we close it before creating a new one
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
                // Take the status of the last goal sent
                const status = msg.status_list[msg.status_list.length - 1].status;
                
                // 3 = SUCCEEDED, 4 = ABORTED, 5 = REJECTED
                // When the navigation terminated, successfully or not, we remove the marker
                if (status === 3 || status === 4 || status === 5) {
                    console.log("Navigation terminated with status:", status);
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

    // If the user confirms the decision, ARI will go to the destination selected by the user
    $("#confirm-yes").on("click", function() {
        // Storage of the coordinates of the destination
        const coords = {
            x: page_manager.selectedX,
            y: page_manager.selectedY
        };
        
        // Pubblication on the path planner topic
        page_manager.common_demo.sendSmartNav(JSON.stringify(coords));
        
        // Check of the status of the sent goal
        page_manager.watchGoalStatus();
        
        page_manager.common_demo.say("Path calculated. Moving through calibration points.");
        $("#confirmation-modal").fadeOut(300);
    });

    $("#dock-btn").on("click", function() {
        // If the user clicks on the dock/undock button, we first need to check if ARI is charging or 
        // not by looking at the isCharging variable, and then we act accordingly. 
        // This action is handled by the same node that performes path planning
        if (page_manager.common_demo.isCharging) {
            console.log("Sending UNDOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("UNDOCK_MANUAL");
            page_manager.common_demo.say("I am undocking, please stand back.");
        } else {
            console.log("Sending DOCK_MANUAL");
            page_manager.common_demo.sendSmartNav("DOCK_MANUAL");
            page_manager.common_demo.say("I am starting the docking procedure.");
        }
    });

    // Zoom buttons
    $("#zoom-in").on("click", () => page_manager.zoom(1.2));

    $("#zoom-out").on("click", () => page_manager.zoom(0.8));

});