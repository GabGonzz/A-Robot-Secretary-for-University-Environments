class CommonDemoARI {
    constructor(options) {
        this.ros = options.ros;
        // RIMOSSO: this.pal_lib = new PalLib(); <-- Qui stava l'errore
        
        this.demo_language = "it_IT";
        this.ari_volume = 0;

        // ROS parameter for the volume (ROSLIB puro)
        this.volume_adjust = new ROSLIB.Param({
            ros: this.ros,
            name: 'volume'
        });

        // Topic for the data log
        this.data_logger = new ROSLIB.Topic({
            ros: this.ros,
            name: 'data_logger',
            messageType: 'std_msgs/String'
        });

        // Topic per far parlare ARI (Sostituisce PalLib.say)
        this.tts_topic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/tts/goal',
            messageType: 'pal_interaction_msgs/TtsActionGoal'
        });

        // Topic for the intents (movement/navigation, ...)
        this.user_intent = new ROSLIB.Topic({
            ros: this.ros,
            name: 'intents',
            messageType: 'pal_web_msgs/WebGoTo' // o il tipo corretto che usi
        });
    }

    init(cb) {
        // RIMOSSO: this.pal_lib.init(); <-- Non serve più
        
        $(".main-container").fadeIn("slow");
        
        this.volumeSlider();
        this.updateStatusBar();
        
        if (cb) cb();
    }

    // NUOVA FUNZIONE SAY (Usa ROS invece di PalLib)
    say(text_to_say) {
        if (text_to_say !== "") {
            const msg = new ROSLIB.Message({
                goal: {
                    rawtext: {
                        text: text_to_say,
                        lang_id: this.demo_language
                    }
                }
            });
            this.tts_topic.publish(msg);
            console.log("ARI dice: " + text_to_say);
        }
    }

    // Volume slider handler
    volumeSlider() {
        // Insertion of the slider in the HTML page, it is hidden in the beginning
        $("body").append(
            '<div class="slidecontainer" id="volume-container" style="display:none; position:fixed; top:80px; left:20px; z-index:9999; background:white; padding:15px; border:3px solid #990000; border-radius:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">' +
                '<div id="minus-volume" style="cursor:pointer; font-size:24px; font-weight:bold; display:inline-block; margin-right:15px; color:#990000;">-</div>' +
                '<div style="display:inline-block; font-family:sans-serif; font-weight:bold;"><span id="volume-value"></span>%</div>' +
                '<div id="plus-volume" style="cursor:pointer; font-size:24px; font-weight:bold; display:inline-block; margin-left:15px; color:#990000;">+</div>' +
            '</div>'
        );

        // Opens/closes the slider after each click on the volume button, the function is implemented
        // here so to not implement it in each "main.js" file, since its behavior is the same in 
        // the entire system
        $(".control-btn[title='Volume']").on('click', function(e) {
            e.stopPropagation();
            $("#volume-container").toggle("fast");
        });

        $("#plus-volume").on('click', () => {
            if (this.ari_volume < 91) this.setVolume(this.ari_volume + 10);
        });

        $("#minus-volume").on('click', () => {
            if (this.ari_volume > 9) this.setVolume(this.ari_volume - 10);
        });

        this.getVolume();
    }

    // Function that displays the value of the volume
    getVolume() {
        this.volume_adjust.get((param) => {
            if (param >= 0) {
                this.ari_volume = (param != 100 && param != 0) ? 5 * Math.round(param * 0.2) : param;
                $("#volume-value").html(this.ari_volume);
            }
        });
    }

    setVolume(target) {
        this.volume_adjust.set(target);
        this.ari_volume = target;
        $("#volume-value").html(this.ari_volume);
    }

    // Function that logs each button when it is pressed
    logButton(button_id) {
        this.data_logger.publish({
            data: "Button press: " + button_id
        });
    }

    // Sends the intent commands to ARI (Navigation, ...)
    sendRobotIntentInput(page_intent_key, intent_="__intent_present_content__") {
        this.user_intent.publish({
            intent: intent_,
            data: '{"object": "' + page_intent_key + '"}',
            source: '__unknown_agent__',
            modality: '__modality_touchscreen__',
            priority: 100,
            confidence: 1.0
        });
    }

    // Function that updates the status bar at the top of each page (date, time and battery)
    updateStatusBar() {
        const update = () => {
            const now = new Date();
            
            // Time update
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeSpan = document.querySelector('#status-time span');
            if (timeSpan) timeSpan.textContent = `${hours}:${minutes}`;
            
            // Date update
            const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
            const dateSpan = document.querySelector('#status-date span');
            if (dateSpan) dateSpan.textContent = now.toLocaleDateString('it-IT', options);
        };

        // The bar is updated after each second
        setInterval(update, 1000);
        update();
        
        // Activates the ROS listener to get the battery value, currently commented because the 
        // ROS environment is not working, but later it will
        // this.subscribeBattery();
    }

    subscribeBattery() {
        // Topic to get the battery level
        const batteryTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/power/battery_level',
            messageType: 'std_msgs/Float32'
        });

        // Topic to get if ARI's battery is charging to display it on the status bar
        const chargingTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/power/is_charging',
            messageType: 'std_msgs/Bool'
        });

        let isCharging = false;

        // Subscribing to the topic to display if the battery is charging or not and display it
        // on the status bar
        chargingTopic.subscribe((msg) => {
            isCharging = msg.data;
            this.updateBatteryUI(null, isCharging); // updates only the icon
        });

        // Subscribing to the topic to get the battery level and display it on the status bar
        batteryTopic.subscribe((msg) => {
            let level = Math.round(msg.data);
            this.updateBatteryUI(level, isCharging);
        });
    }

    // Function to update the icon and the text
    updateBatteryUI(level, isCharging) {
        const batterySpan = document.getElementById('battery-level');
        const batteryIcon = document.querySelector('#status-battery i');

        if (batterySpan && level !== null) {
            batterySpan.textContent = level + "%";
        }

        if (batteryIcon) {
            // If the battery is charging, a lightning bolt will appear instead of the battery level
            if (isCharging) {
                batteryIcon.className = "fa-solid fa-bolt";
                batteryIcon.style.color = "#f1c40f"; // Giallo ricarica
            } else if (level !== null) {
                // If the battery is not charging, it will be displayed its level of charge
                // with a color which varies depending on how high is the level
                if (level <= 20) {
                    batteryIcon.className = "fa-solid fa-battery-quarter";
                    batteryIcon.style.color = "#e74c3c";    // red
                } else if (level <= 50) {
                    batteryIcon.className = "fa-solid fa-battery-half";
                    batteryIcon.style.color = "#f39c12";    // yellow/orange
                } else {
                    batteryIcon.className = "fa-solid fa-battery-full";
                    batteryIcon.style.color = "#27ae60";   // green
                }
            }
        }
    }
}