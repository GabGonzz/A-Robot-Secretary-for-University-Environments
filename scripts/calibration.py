#!/usr/bin/env python3

import rospy
import cv2
from cv2 import aruco
import numpy as np
import tf2_ros
import tf2_geometry_msgs
import tf.transformations
from sensor_msgs.msg import Image, CompressedImage
from cv_bridge import CvBridge
from geometry_msgs.msg import PoseWithCovarianceStamped, PoseStamped
import os
import sys
script_dir = os.path.dirname(os.path.realpath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
from ArUco_data import ArUcos
from camera_data import *

class AriArucoLocalizer:
    def __init__(self):
        # Create a node to localize and calibrate ARI
        rospy.init_node('ari_aruco_localizer')

        # We utilize OpenCV to convert images in OpenCV matrixes, so we can utilize computer vision to 
        # understand the content of the image and see if there are arucos in it
        self.bridge = CvBridge()

        # Begins listening to every part of ARI in order to localize where each part is in every moment,
        # so to understand if AR is seeing the marker with the torso camera or with the head camera.
        self.tf_buffer = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buffer)

        # Frame names
        self.HEAD_FRAME = "head_front_camera_color_optical_frame"
        self.TORSO_FRAME = "torso_front_camera_color_optical_frame"

        # Publishers: they tell ARI the position to move in the map
        self.pub_myPos = rospy.Publisher('/initialpose', PoseWithCovarianceStamped, queue_size=5)
        self.pub_torso_debug = rospy.Publisher('/torso_front_camera/color/aruco_debug', Image, queue_size=2)
        self.pub_head_debug = rospy.Publisher('/head_front_camera/color/aruco_debug', Image, queue_size=2)

        # Subscribers: they listen to the data that ARI sends, and when they receive something to work 
        # with, the function to process teh data is called
        self.sub_torso = rospy.Subscriber('/torso_front_camera/color/image_raw', Image, self.image_callback)
        self.sub_head = rospy.Subscriber('/head_front_camera/color/image_raw/compressed', CompressedImage, self.compressed_callback)

        # ArUcos parameters, we use 4x4 ArUcos with 8 cm edges
        self.aruco_dict = aruco.Dictionary_get(aruco.DICT_4X4_50)
        self.aruco_params = aruco.DetectorParameters_create()
        self.marker_size = 0.08 

        # State variables, useful to tell ARI to wait to calibrates itself again
        self.last_correction_time = 0
        self.cooldown_period = 3.0 
        
        # We tell ARI to ignore markers more distant than 2.5 m, since they could be not reliable
        self.max_dist = 2.5

        rospy.loginfo("--- ARUCO LOCALIZER STARTED ---")

    def rvec_to_quaternion(self, rvec):

        # When an ArUco is detected, its rotation is displayed as a rotation vector, so we convert it to 
        # a rotation matrix with cv2.Rodrigues() function
        rot_matrix, _ = cv2.Rodrigues(rvec)

        # initialization of a homogeneous transformation matrix, which we fill with the rotation matrix 
        # computed before, utilizing only the 3x3 part of the matrix, leaving the trasposition/position 
        # part free to use for later
        matrix = np.eye(4)
        matrix[0:3, 0:3] = rot_matrix

        # function to convert the rotation matrix into quaternions, since ROS reads only quaternions to 
        # handle rotation
        return tf.transformations.quaternion_from_matrix(matrix)

    def compressed_callback(self, msg):
        #function to convert the compressed images arriving from the head camera to a readable format

        # stores the msg.data arrived, that is a sequence of bytes, in a numpy array, that is a number 
        # table and tell to treat those numbers as 8-bit data pieces
        np_arr = np.frombuffer(msg.data, np.uint8)

        # Reconstructs the image by decoding each piece of data in the pixel grid of which the image 
        # is composed of
        cv_image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # sends the ready image to the function to detect if there are arucos in it
        self.process_detection(cv_image, self.HEAD_FRAME)

    def image_callback(self, msg):
        # handles the images arriving from the torso camera to convert it in a readable format

        # stores the ROS message in a OpenCV matrix
        cv_image = self.bridge.imgmsg_to_cv2(msg, "bgr8")

        # sends the image to the function to detect if there are arucos in it
        self.process_detection(cv_image, self.TORSO_FRAME)

    def process_detection(self, frame, camera_frame):
        # function to see if there are arucos in the received image

        # Firstly, we convert the image in a gray scale, since it is easier to detect arucos 
        # by using the black and white contrast
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # function to detect if there are arucos in the image
        corners, ids, _ = aruco.detectMarkers(gray, self.aruco_dict, parameters=self.aruco_params)

        if ids is not None:
            # See if the image comes from the torso or from the head camera, since they have different 
            # resolution, we need to act different with each of those
            if "head" in camera_frame:
                mtx, dist_coeff = K_HEAD, D_HEAD
            else:
                mtx, dist_coeff = K_TORSO, D_TORSO

            # by knowing how big is the aruco in the reality, we compute its position with respect to the 
            # camera by using the rotation and translation vector
            rvecs, tvecs, _ = aruco.estimatePoseSingleMarkers(corners, self.marker_size, mtx, dist_coeff)
            
            # If the marker seen is in our database, we send its data to our calibrate function
            for i in range(len(ids)):
                marker_id = str(ids[i][0])
                if marker_id in ArUcos:
                    self.calibrate(marker_id, tvecs[i][0], rvecs[i][0], camera_frame)
            
            # part useful for debugging, to see if the images coming from ARI are correct or not. 
            # It is possible to view these images by using rqt_image_view
            aruco.drawDetectedMarkers(frame, corners, ids)
            msg_img = self.bridge.cv2_to_imgmsg(frame, "bgr8")
            if "head" in camera_frame:
                self.pub_head_debug.publish(msg_img)
            else:
                self.pub_torso_debug.publish(msg_img)

    def calibrate(self, marker_id, tvec, rvec, camera_frame):
        # Function to calibrate ARI in the map based on the aruco we have detected and how we detected it
        now = rospy.get_time()
        
        # if it passed too little time from the last correction, we ignore it
        if (now - self.last_correction_time) < self.cooldown_period:
            return

        # We consider only data arriving from max 2.0 m, since if they were more distant, they could 
        # be not reliable
        dist = np.linalg.norm(tvec)
        if dist > self.max_dist:
            return

        try:
            # erase the slashes since the correct name does not include them
            clean_camera_frame = camera_frame.lstrip('/')

            # Here, ARI just saw the marker. Firstly, we convert the rotation vector to quaternions
            q_cam_marker = self.rvec_to_quaternion(rvec)
            # Then, we combine the position and the rotation of the marker respect to the camera in a 
            # unique matrix to obtain the position of the camera compared to the position of the marker
            cam_T_marker = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix(tvec),
                tf.transformations.quaternion_matrix(q_cam_marker)
            )
            # Lastly, we invert the matrix, so instead of thinking from the point of view of the robot, 
            # we view the situation from the point of view of the marker (e.g., instead of saying "the 
            # marker is 80 cm away from the robot", we say "if I'm the marker, where is the camera compared 
            # to me?") 
            marker_T_cam = tf.transformations.inverse_matrix(cam_T_marker)

            # Here, we compute the position of the base compared to the camera. 
            # Firstly, we retrieve the position of the camera compared to the base
            trans = self.tf_buffer.lookup_transform("base_footprint", clean_camera_frame, rospy.Time(0), rospy.Duration(0.5))
            # Then, we compute the position of the base compared to the camera by calculating the inverse of 
            # the matrix, just like we did before
            base_T_cam = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix([trans.transform.translation.x, trans.transform.translation.y, trans.transform.translation.z]),
                tf.transformations.quaternion_matrix([trans.transform.rotation.x, trans.transform.rotation.y, trans.transform.rotation.z, trans.transform.rotation.w])
            )
            cam_T_base = tf.transformations.inverse_matrix(base_T_cam)

            # Here, we store in a matrix the data retrieved before that tell us the position of the markers
            # in the map. We will use this information to compute the actual position of ARI in the map
            m_data = ArUcos[marker_id]
            map_T_marker = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix(m_data["position"]),
                tf.transformations.quaternion_matrix(m_data["orientation"])
            )

            # Here there is the final computation, where we multiply the three matrixes built before to 
            # find the real position of ARI in the map. So, we store the result in a matrix.
            map_T_base = tf.transformations.concatenate_matrices(map_T_marker, marker_T_cam, cam_T_base)
            
            # To make the results readable for ROS, we separate and convert the computed matrix in a 
            # translation vector and in quaternions
            new_pos = tf.transformations.translation_from_matrix(map_T_base)
            new_q = tf.transformations.quaternion_from_matrix(map_T_base)

            # Here, we create the message to send to the topic to change the position.
            # firstly, we create the header thatt contains the time and the frame id to address
            msg = PoseWithCovarianceStamped()
            msg.header.stamp = rospy.Time.now()
            msg.header.frame_id = "map"

            # we set the new position with the coordinates computed before, while paying attention to set the 
            # z-coordinates to 0.0, to not make the robot levitate or go underground due to some computation errors
            msg.pose.pose.position.x = new_pos[0]
            msg.pose.pose.position.y = new_pos[1]
            msg.pose.pose.position.z = 0.0 
            
            # We set the new rotation of the robot
            msg.pose.pose.orientation.x = new_q[0]
            msg.pose.pose.orientation.y = new_q[1]
            msg.pose.pose.orientation.z = new_q[2]
            msg.pose.pose.orientation.w = new_q[3]

            # we set the covariance to tell the robot that we are sure that the new position is 
            # right, so it will overwrite the old position
            msg.pose.covariance = [0.0] * 36
            msg.pose.covariance[0] = 0.01  # X
            msg.pose.covariance[7] = 0.01  # Y
            msg.pose.covariance[35] = 0.01 # Yaw

            # We send the message with the new position to ARI and set the last correction time to now
            self.pub_myPos.publish(msg)
            self.last_correction_time = now
            rospy.loginfo(">>> RECALIBRATING: ArUco %s (Distance: %.2fm)", marker_id, dist)

        except Exception as e:
            rospy.logwarn("Calibration error: %s", e)

if __name__ == '__main__':
    try:
        AriArucoLocalizer()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass