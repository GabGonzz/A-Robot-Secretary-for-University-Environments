FROM ros:noetic-ros-base

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-opencv \
    python3-numpy \
    python-is-python3 \
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

COPY ./display ./display
COPY ./scripts ./scripts

RUN chmod +x ./scripts/*.py

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh

# Esponiamo la nuova porta web e documentiamo l'uso della 9090 di host
EXPOSE 8081 9090

ENTRYPOINT ["/entrypoint.sh"]