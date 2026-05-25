FROM ros:noetic-ros-base

ENV DEBIAN_FRONTEND=noninteractive

# Installazione delle librerie di sistema e pacchetti ROS standard
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-opencv \
    python3-numpy \
    ros-noetic-rosbridge-suite \
    ros-noetic-cv-bridge \
    ros-noetic-tf \
    ros-noetic-tf2-ros \
    ros-noetic-tf2-geometry-msgs \
    ros-noetic-actionlib \
    ros-noetic-move-base-msgs \
    ros-noetic-navigation \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /ari_app

# Copia l'interfaccia web e i nodi ROS all'interno del container
COPY ./display ./display
COPY ./scripts ./scripts

# Rende eseguibili gli script Python
RUN chmod +x ./scripts/*.py

# Copia e imposta lo script di avvio
COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh

# Esponi le porte per l'interfaccia web (8080) e rosbridge (9090)
EXPOSE 8080 9090

ENTRYPOINT ["/entrypoint.sh"]