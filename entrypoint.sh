#!/bin/bash
set -e

# 1. Carica l'ambiente ROS standard del container
source /opt/ros/noetic/setup.bash

# 2. Carica i pacchetti di sistema PAL (versione gallium)
if [ -f /opt/pal/gallium/setup.bash ]; then
    source /opt/pal/gallium/setup.bash
fi

# 3. Carica gli eventuali pacchetti custom deployati sul robot
if [ -f /home/pal/deployed_ws/devel/setup.bash ]; then
    source /home/pal/deployed_ws/devel/setup.bash
fi

echo "Avvio del server web per l'interfaccia sulla porta 8080..."
cd /ari_app/display
python3 -m http.server 8080 &

echo "Avvio della logica di navigazione e gestione ArUco..."
exec roslaunch /ari_app/scripts/custom_nodes.launch