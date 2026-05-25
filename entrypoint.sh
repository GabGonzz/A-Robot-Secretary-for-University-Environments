#!/bin/bash
set -e

source /opt/ros/noetic/setup.bash

if [ -f /opt/pal/gallium/setup.bash ]; then
    source /opt/pal/gallium/setup.bash
fi

if [ -f /home/pal/deployed_ws/devel/setup.bash ]; then
    source /home/pal/deployed_ws/devel/setup.bash
fi

echo "Avvio del server web per l'interfaccia sulla porta 8081..."
cd /ari_app/display
python3 -m http.server 8081 &

echo "Avvio della logica di navigazione e gestione ArUco..."
exec roslaunch /ari_app/scripts/custom_nodes.launch