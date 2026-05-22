class CommonDemoARI {
    constructor(options) {
        this.ros = options.ros;
        this.config = null;
        // RIMOSSO: this.pal_lib = new PalLib(); <-- Qui stava l'errore
        
        this.demo_language = "en_GB";
        this.ari_volume = 0;

        this.isCharging = false;

        // ROS parameter for the volume (ROSLIB puro)
        this.volume_adjust = new ROSLIB.Param({
            ros: this.ros,
            name: '/pal/playback_volume' 
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

        this.smart_nav_topic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/ui/navigation_request',
            messageType: 'std_msgs/String'
        });

        this.relocalization_sub = new ROSLIB.Topic({
            ros: this.ros,
            name: '/initialpose',
            messageType: 'geometry_msgs/PoseWithCovarianceStamped'
        });

        this.eyes_topic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/robot_face/expression', 
            messageType: 'hri_msgs/Expression' 
        });

        this.pupils_topic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/robot_face/look_at',
            messageType: 'geometry_msgs/PointStamped'
        });
    }

    async init(cb) {
        await this.loadGlobalConfig();
        
        $(".main-container").fadeIn("slow");
        
        this.volumeSlider();
        this.updateStatusBar();
        this.setEyes("amazed");
        this.lookStraight();
        
        if (cb) cb();
    }

    // Nuova funzione per caricare i dati e applicare il logo
    async loadGlobalConfig() {
        try {
            // Usiamo un percorso che funzioni da quasi ovunque. 
            // Se le pagine sono a profondità diverse, potresti dover 
            // passare il path come opzione, ma proviamo con quello relativo ai tools
            const response = await fetch('../tools/assets/configuration.json');
            this.config = await response.json();

            console.log("Configurazione globale caricata nel core.");

            // Applichiamo il logo automaticamente se esiste l'elemento nell'HTML
            const logoElement = document.getElementById('main-logo');
            if (logoElement && this.config.logo_path) {
                // CORREZIONE QUI: Accedi a this.config.logo_path
                const logoPath = "../tools/assets/" + this.config.logo_path;
                logoElement.src = logoPath;
            }
        } catch (error) {
            console.error("Errore caricamento config nel core:", error);
        }
    }

    // NUOVA FUNZIONE SAY (Usa ROS invece di PalLib)
    say(text_to_say, lang = this.demo_language) {
        if (text_to_say !== "") {
            this.tts_topic.publish({
                goal: {
                    rawtext: {
                        text: text_to_say,
                        lang_id: lang
                    },
                    speakerName: '',
                    wait_before_speaking: 0.0
                }
            });
            console.log("ARI says: " + text_to_say);
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
            if (param !== null && param >= 0) {
                // Se il robot restituisce un valore, lo usiamo come base
                this.ari_volume = parseInt(param);
                $("#volume-value").html(this.ari_volume);
            } else {
                // Se il parametro è vuoto (raro), mettiamo un default
                this.setVolume(10);
            }
        });
    }

    setVolume(target) {
        // 1. Assicuriamoci che sia un numero intero
        let vol_int = parseInt(target);

        // 2. Lo scriviamo nel parametro corretto
        this.volume_adjust.set(vol_int);

        // 3. Aggiorniamo la variabile interna e l'interfaccia
        this.ari_volume = vol_int;
        $("#volume-value").html(this.ari_volume);

        console.log("Volume sincronizzato con successo a: " + vol_int + "%");
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
        this.subscribeBattery();
    }

    subscribeBattery() {
        // Salviamo il riferimento alla classe
        const self = this;

        const batteryTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/power/battery_level',
            messageType: 'std_msgs/Float32'
        });

        const chargingTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/power/is_charging',
            messageType: 'std_msgs/Bool'
        });

        // Usiamo 'self' invece di 'this' per essere sicuri al 100%
        chargingTopic.subscribe((msg) => {
            self.isCharging = msg.data;
            self.updateBatteryUI(null, self.isCharging);
        });

        batteryTopic.subscribe((msg) => {
            let level = Math.round(msg.data);
            self.updateBatteryUI(level, self.isCharging);
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

    sendSmartNav(destinationId) {
        const msg = new ROSLIB.Message({
            data: destinationId
        });
        this.smart_nav_topic.publish(msg);
        console.log("Comando Smart Nav inviato per: " + destinationId);
    }

    subscribeToCalibration(onCalibratedCallback) {
        this.relocalization_sub.subscribe((msg) => {
            console.log("Ricalibrazione ricevuta da ROS!");
            
            // Esegui una funzione di callback nell'UI se passata
            if (onCalibratedCallback) {
                onCalibratedCallback(msg);
            }
        });
    }

    // Funzione per cambiare l'espressione/forma degli occhi
    setEyes(shape_name) {
        if (shape_name !== "") {
            const msg = new ROSLIB.Message({
                expression: shape_name // <-- MODIFICATO QUI
            });
            this.eyes_topic.publish(msg);
            console.log("Eyes shape modified to: " + shape_name);
        }
    }

    // Funzione per centrare lo sguardo (solo pupille)
    lookStraight() {
        const msg = new ROSLIB.Message({
            header: {
                frame_id: 'base_link' // Il riferimento è la base del robot
            },
            point: {
                x: 2.0, // Guarda un punto a 2 metri in avanti
                y: 0.0, // Perfettamente centrato (0 = né a destra né a sinistra)
                z: 1.5  // Altezza di 1.5 metri (circa l'altezza visiva di una persona)
            }
        });
        
        this.pupils_topic.publish(msg);
        console.log("Pupille centrate in avanti.");
    }
}