#!/usr/bin/env python
import rospy
import tf2_ros
import tf2_geometry_msgs
import cv2
from cv2 import aruco
import numpy as np
import tf.transformations
from sensor_msgs.msg import Image, CompressedImage
from cv_bridge import CvBridge
from geometry_msgs.msg import PoseStamped, PoseWithCovarianceStamped, Twist

class ArUcoSmartMapper:
    def __init__(self):
        # Initialization of the node to log the position of the arucos in the map. We set anonymous 
        # to true to make it possible to launch different instances of this script in the same time
        rospy.init_node('aruco_smart_mapper', anonymous=True)

        # We utilize OpenCV to convert images in OpenCV matrixes, so we can utilize computer vision to 
        # understand the content of the image and see if there are arucos in it
        self.bridge = CvBridge()

        # Begins listening to every part of ARI in order to localize where each part is in every moment,
        # so to understand if AR is seeing the marker with the torso camera or with the head camera.
        self.tf_buffer = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buffer)
        
        # ArUcos parameters, we use 4x4 ArUcos with 8 cm edges
        self.aruco_dict = aruco.Dictionary_get(aruco.DICT_4X4_50)
        self.parameters = aruco.DetectorParameters_create()
        self.marker_size = 0.08 

        # initialization of the list that will contain the known markers, useful to calibrate the position 
        # by going back to a known marker during the detection
        self.known_markers = {} 
        self.pub_initialpose = rospy.Publisher('/initialpose', PoseWithCovarianceStamped, queue_size=5)

        # dictionary to wait to record the marker
        self.first_seen_time = {}

        # We monitor the speed at which ARI is going to make sure to get a clean image of the arucos. If 
        # ARI is going too fast, we will ignore the data collected, since they are not reliable
        self.current_velocity = 0.0
        rospy.Subscriber('/mobile_base_controller/odom', Twist, self.odom_callback)

        # We divide the sources if the images, since they have two different resolutions
        self.HEAD_FRAME = "head_front_camera_color_optical_frame"
        self.TORSO_FRAME = "torso_front_camera_color_optical_frame"

        # Subscription to the cameras to get the images
        rospy.Subscriber('/torso_front_camera/color/image_raw', Image, self.callback, "TORSO")
        rospy.Subscriber('/head_front_camera/color/image_raw/compressed', CompressedImage, self.callback_compressed, "HEAD")

        # dictionary to keep track of the last time we received an update to not update too frequently
        self.last_update = {}
        rospy.loginfo("--- SMART MAPPER AVVIATO (FILTRO <1m + ID<=15) ---")

    def odom_callback(self, msg):
        # Speed computation to understand if ARI is moving or not
        self.current_velocity = abs(msg.linear.x) + abs(msg.angular.z)

    def callback_compressed(self, msg, source):
        # function to convert the images arriving from the head camera in useful data, since the images 
        # coming from the head camera are in a compressed state and it is not possible to work with them.

        # stores the msg.data arrived, that is a sequence of bytes, in a numpy array, that is a number 
        # table and tell to treat those numbers as 8-bit data pieces
        np_arr = np.frombuffer(msg.data, np.uint8)

        # Reconstructs the image by decoding each piece of data in the pixel grid of which the image 
        # is composed of
        cv_image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # sends the ready image to the function to detect if there are arucos in it
        self.process_vision(cv_image, self.HEAD_FRAME)

    def callback(self, msg, source):
        # handles the images arriving from the torso camera to convert it in a readable format

        # stores the ROS message in a OpenCV matrix
        cv_image = self.bridge.imgmsg_to_cv2(msg, "bgr8")

        # sends the image to the function to detect if there are arucos in it
        self.process_vision(cv_image, self.TORSO_FRAME)

    def process_vision(self, cv_image, frame_id):
        # if ARI is moving too fast, we ignore the data
        if self.current_velocity > 0.1:
            self.first_seen_time = {} 
            return
        
        # convert the image in a gray scale to make it easierto find arucos
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        corners, ids, _ = aruco.detectMarkers(gray, self.aruco_dict, parameters=self.parameters)
        
        if ids is not None:
            # computation of the translation and rotation vectors with the parameters of the camera head
            intrinsic = np.array([[999.461170663331, 0, 642.2582577578172], [0, 996.9611451866272, 474.1471906434584], [0, 0, 1]])
            dist_coeffs = np.array([0.1644, -0.2717, -0.0028, -0.00009, 0.0])
            rvecs, tvecs, _ = aruco.estimatePoseSingleMarkers(corners, self.marker_size, intrinsic, dist_coeffs)
            
            for i in range(len(ids)):
                m_id_int = ids[i][0]

                # since in the laboratory there were some arucos that i was not using, I ignored them
                if m_id_int > 15: continue 
                
                # Converts the id of the aruco to string
                m_id = str(m_id_int)
                dist_to_marker = np.linalg.norm(tvecs[i][0])

                # considers the marker only if it is not too distant
                if dist_to_marker > 1.0:
                    continue

                now = rospy.get_time()

                # If it's the first time seeing this marker, we save its coordinates and display them
                if m_id not in self.known_markers:
                    # we wait to stabilize for 5 seconds before saving the coordinates
                    if m_id not in self.first_seen_time:
                        self.first_seen_time[m_id] = now
                        rospy.loginfo("Identificato marker %s... resta fermo 5s per registrare", m_id)
                    
                    # If 5 seconds are passed since we saw the marker, we save its coordinates
                    elif (now - self.first_seen_time[m_id]) >= 5.0:
                        self.save_new_marker(m_id, tvecs[i][0], rvecs[i][0], frame_id)
                        # we remove it from the timer since now we registered it
                        del self.first_seen_time[m_id]
                else:
                    # If we have already seen this marker, we use it to calibrate our position 
                    # based on the coordinates stored in the list
                    if (now - self.last_update.get(m_id, 0)) > 4.0:
                        self.correct_robot_pose(m_id, tvecs[i][0], rvecs[i][0], frame_id)
                        self.last_update[m_id] = now

    def save_new_marker(self, marker_id, tvec, rvec, frame_id):
        try:
            # Initialization of a pose object obtained with the coordinates of the last marker seen. So, 
            # we set the fields of this object equal to the values of the translation vector and of the 
            # rotation vector
            p = PoseStamped()
            p.header.frame_id = frame_id
            p.header.stamp = rospy.Time(0)
            p.pose.position.x, p.pose.position.y, p.pose.position.z = tvec
            q = tf.transformations.quaternion_from_matrix(self.rvec_to_mat(rvec))
            p.pose.orientation.x, p.pose.orientation.y, p.pose.orientation.z, p.pose.orientation.w = q


            # check if it is possible to connect the data from the map to what the robot 
            # is seeing from the camera within 0.5 seconds
            if self.tf_buffer.can_transform("map", frame_id, rospy.Time(0), rospy.Duration(0.5)):
                # If the check was succesful, we retrieve the position and rotation of the robot's 
                # camera compared to the zero of the map in this instant
                transform = self.tf_buffer.lookup_transform("map", frame_id, rospy.Time(0))

                # result of the multiplication between the position of the marker compared to the camera 
                # and the position of the camera compared to the map. By doing this, we are able to know the 
                # position of the marker relative to the map
                p_map = tf2_geometry_msgs.do_transform_pose(p, transform)

                # Data cleaning to make the database more readable
                self.known_markers[marker_id] = {
                    "position": [round(p_map.pose.position.x, 6), round(p_map.pose.position.y, 6), round(p_map.pose.position.z, 6)],
                    "orientation": [round(p_map.pose.orientation.x, 6), round(p_map.pose.orientation.y, 6), 
                                    round(p_map.pose.orientation.z, 6), round(p_map.pose.orientation.w, 6)]
                }
                rospy.loginfo("+++ MAPPATO ID %s (Distanza: %.2fm)", marker_id, np.linalg.norm(tvec))
                print('    "{}" : {},'.format(marker_id, self.known_markers[marker_id]))
        except Exception as e:
            pass

    def correct_robot_pose(self, marker_id, tvec, rvec, frame_id):
        # Function to correct the pose of the robot when it sees a marker that he has already mapped
        try:
            # retrieve the data of the marker that has just been detected from the list
            m_data = self.known_markers[marker_id]
            map_T_marker = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix(m_data["position"]),
                tf.transformations.quaternion_matrix(m_data["orientation"]))
            
            # computation of a homogeneous transformation matrix that describes the position of the 
            # marker relatively to the camera. This computation is done by combining the translation 
            # matrix with the rotation matrix
            cam_T_marker = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix(tvec),
                tf.transformations.quaternion_matrix(tf.transformations.quaternion_from_matrix(self.rvec_to_mat(rvec))))
            
            # computation of the inverse of the just calculated matrix to acknowledge the position of the 
            # robot from the point of view of the marker. In this way, we are able to acknowledge the position 
            # of the robot relatively to the map
            marker_T_cam = tf.transformations.inverse_matrix(cam_T_marker)

            # Computation of the position of the base of ARI relatively to the position of the camera. This is 
            # useful in order to find the position of the base of ARI by using the position of its camera
            trans = self.tf_buffer.lookup_transform("base_footprint", frame_id, rospy.Time(0), rospy.Duration(0.5))
            base_T_cam = tf.transformations.concatenate_matrices(
                tf.transformations.translation_matrix([trans.transform.translation.x, trans.transform.translation.y, trans.transform.translation.z]),
                tf.transformations.quaternion_matrix([trans.transform.rotation.x, trans.transform.rotation.y, trans.transform.rotation.z, trans.transform.rotation.w]))
            
            # The last computation that tells us the position of ARI in relation of the map coordinates. 
            # We obtain that by combining the matrixes seen before and the inverse of the just computed 
            # base_T_cam. So, the result is the exact position of ARI relatively to the zero of the map
            map_T_base = tf.transformations.concatenate_matrices(map_T_marker, marker_T_cam, tf.transformations.inverse_matrix(base_T_cam))

            # we store the new position in new variables, one for the translation and the other for the 
            # rotation
            new_pos = tf.transformations.translation_from_matrix(map_T_base)
            new_q = tf.transformations.quaternion_from_matrix(map_T_base)

            # We fill a new message with these new coordinates and we publish it in the initial pose 
            # topic while using a low covariance value, so it will overwrite the current value
            msg = PoseWithCovarianceStamped()
            msg.header.stamp = rospy.Time.now()
            msg.header.frame_id = "map"
            msg.pose.pose.position.x, msg.pose.pose.position.y = new_pos[0], new_pos[1]
            msg.pose.pose.orientation.x, msg.pose.pose.orientation.y, msg.pose.pose.orientation.z, msg.pose.pose.orientation.w = new_q
            msg.pose.covariance = [0.01] * 36 
            self.pub_initialpose.publish(msg)
            rospy.loginfo(">>> CORREZIONE con ID %s", marker_id)
        except:
            pass

    def rvec_to_mat(self, rvec):
        # function to convert the rotation vectors to matrixes and therefore to use them in 
        # further computations

        # initialization of the rotation matrix obtained starting from the rotation vector
        rot_matrix, _ = cv2.Rodrigues(rvec)

        # initialization of a new identity matrix
        mat = np.eye(4)

        # fill the identity matrix with the values of the rotation matrix. We fill only the 3x3 part 
        # because the remaining part will be used to store the translation values
        mat[0:3, 0:3] = rot_matrix
        return mat

if __name__ == '__main__':
    ArUcoSmartMapper()
    rospy.spin()