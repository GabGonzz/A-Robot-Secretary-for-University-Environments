# A Robot Secretary for University Environments: Developing the Navigation and Interaction System for the ARI Robot

This project explores the development and deployment of the PAL Robotics ARI robot within the University of Trento. Specifically, it features a custom user interface designed to control and monitor the robot's functionalities, a series of personalized human-robot interactions, and a dedicated navigation system tailored for orienting and moving autonomously within the university environment.

---

## Contents
- [Repository Structure](#-repository-structure)
- [System Architecture](#-system-architecture)
- [Main Components](#-main-components)
  - [ROS Backend](#1-ros-backend)
  - [UI Frontend](#2-ui-frontend)
- [System Requirements](#-system-requirements)
- [Docker Deployment](#-docker-deployment)

---

## Repository Structure

The repository is organized into two main components: the frontend interface and the ROS backend scripts. The frontend directory is subdivided into modular folders, each containing an HTML file for the page layout and a JavaScript file that manages screen interactions, telemetry, and dynamically loads configurations.

```text
├── README.md
├── display                     # Frontend web interface components
│   ├── README.md
│   ├── back_cam
│   ├── cam_menu
│   ├── degree_presentation
│   ├── front_cam
│   ├── front_fisheye_cam
│   ├── interactions
│   ├── map
│   ├── menu
│   ├── navigation_menu
│   ├── news
│   ├── poi
│   ├── python_scripts          # Script to fetch and update current news into the configuration files
│   ├── rear_fisheye_cam
│   ├── room_presentation
│   ├── speech
│   ├── start_screen
│   ├── tools                   # Shared assets, styles, and core modules
│   │   ├── assets
│   │   ├── js
│   │   │   ├── core.js         # Core script handling global configuration and rosbridge communication
│   │   │   └── lib             # External JavaScript libraries
│   │   └── style
│   │       └── style.css
│   ├── torso_cam
│   └── torso_front_cam_infra
└── scripts                     # ROS Backend (Python nodes and launch files)
    ├── ArUco_data.py
    ├── aruco_logger.py
    ├── calibration.py
    ├── camera_data.py
    ├── custom_nodes.launch
    └── path_planner.py
```
---

## System Architecture

The system coordinates user interactions with the interface and backend responses by using the WebSocket ROSBridge, which allows to send messages in JSON format from the frontend to the backend and vice versa to make the system communicate correctly. The logic of this communication can be found in the  /display/tools/core.js file, which defines multiple functions used around the whole frontend part to communicate with the backend to build an abstraction layer and make the whole project more readable. 