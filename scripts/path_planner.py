#!/usr/bin/env python3
import rospy
import math
import tf
import actionlib
import json
from nav_msgs.srv import GetPlan
from std_msgs.msg import String
from geometry_msgs.msg import PoseStamped
from pal_composite_navigation_msgs.msg import GoToFloorPOIAction, GoToFloorPOIGoal
from dock_charge_sm_msgs.msg import GoAndDockAction, GoAndDockGoal
from laser_servoing_msgs.msg import UndockAction, UndockGoal
from move_base_msgs.msg import MoveBaseAction, MoveBaseGoal

class AriSmartNavigator:
    def __init__(self):
        # custom node initialization
        rospy.init_node('smart_navigator_node')
        
        # get the current floor where ARI is. If it won't return any floor, it will use 
        # the "floor_12" parameter, that is the one described by the only map that we are using
        self.floor = rospy.get_param("/current_floor", "floor_12")
        
        rospy.loginfo("Loading of the map's POI...")
        
        # we set a timeout value that works as a limit to which we will wait for the loading of 
        # the map's POI. After either the limit will be reached or the POIs will be correctly 
        # loaded, we will continue with the rest of the script
        timeout = 30
        start_time = rospy.get_time()

        # while loop that implements the timeout wait for the fetching of the POIs
        while not rospy.has_param("/mmap/poi/submap_0") and not rospy.is_shutdown():
            if rospy.get_time() - start_time > timeout:
                rospy.logerr("TIMEOUT: POIs were not loaded on time")
                break
            rospy.sleep(1.0)

        # Fetching the POIs, if this results in some error, we will load an empty value
        self.all_checkpoints = rospy.get_param("/mmap/poi/submap_0", {})
        
        # Check if the POIs were correctly fetched or if we resulted in having an 
        # empty variable, meaning that the POIs were not loaded correctly
        if not self.all_checkpoints:
            rospy.logerr("ATTENZIONE: Lista POI vuota dopo il caricamento!")
        else:
            rospy.loginfo(f"Caricati {len(self.all_checkpoints)} POI correttamente.")

        # Setting the transform listener, that is ROS' system useful to handle coordinates 
        # and locating ARI in the map
        self.tf_listener = tf.TransformListener()

        # Setup of the client of the composite navigation. This type of navigation is asynchronous 
        # since, it uses the Actions that are asynchronous too. This means that we can send a goal, 
        # and then some time after ask for a feedback to know if the robot arrived or not. We use 
        # the composite navigation to handle the navigation when the goal is a known point of interest, 
        # so we need the name of the POI and not its coordinates to reach it
        self.nav_client = actionlib.SimpleActionClient('/composite_navigation', GoToFloorPOIAction)
        
        rospy.loginfo("Waiting for /composite_navigation...")

        # Blocks the execution of the script until ARI's navigation system is ready. This prevents 
        # sending navigation commands while ARI is not ready yet
        self.nav_client.wait_for_server()

        # Setup of the move base navigation, that works exactly like the setup of the composite navigation. 
        # We also use this type of navigation to handle the case when the final goal is a set of coordinates 
        # in the map and not a known point of interest
        self.move_base_client = actionlib.SimpleActionClient('/move_base', MoveBaseAction)
        rospy.loginfo("Waiting for /move_base...")
        self.move_base_client.wait_for_server()

        # Setup of ARI's simulation system, that is the system that computes the path of the robot 
        # to reach the goal. We use it to see if there are any checkpoints on the planned path and, 
        # if that is the case, we should pass by those checkpoints
        rospy.wait_for_service('/move_base/make_plan')
        self.plan_service = rospy.ServiceProxy('/move_base/make_plan', GetPlan)

        # Setup of the subscriber that receives the messages sent from the frontend which contain 
        # the goal. When the subscriber will receive a message, it will call the ui_callback function 
        # which is defined later in this script
        rospy.Subscriber("/ui/navigation_request", String, self.ui_callback)

        # Setup for the handling of the docking action, which works with Action Client commands like the 
        # navigation, useful to send and receive feedbacks asynchronously. We wait 5 seconds for the 
        # server to setup everything, then we will move on whether the server responded or not
        self.dock_client = actionlib.SimpleActionClient('/go_and_dock', GoAndDockAction)
        self.dock_client.wait_for_server(rospy.Duration(5.0))

        # Same setup of the docking system, but for the undock action
        self.undock_client = actionlib.SimpleActionClient('/undocker_server', UndockAction)
        self.undock_client.wait_for_server(rospy.Duration(5.0))
        
        rospy.loginfo("SYSTEM READY: waiting for navigation commands")

    def get_robot_pose(self):
        """Gets ARI's x, y relatively to the map"""

        # We use a try/except block to handle the exceptions in the code instead of making 
        # the whole script crash
        try:
            # Waits up to two seconds for the computation of the position between the robot and the 
            # map to be available. "/map" is the origin of the reference system, which position relatively 
            # to the real origin of the map image (that conventionally would be the bottom-left corner) is 
            # specified in the map.yaml file in ARI's system. The coordinates of the robot relatively to 
            # the map are computed compared to the origin, knowing that its coordinates are (0, 0). 
            # "base_footprint" is ARI's center projected on the floor.
            self.tf_listener.waitForTransform("/map", "/base_footprint", rospy.Time(0), rospy.Duration(2.0))

            # After checking that the position is available and no error occurred, we retrieve it 
            # and store it in these two variables. Specifically, "trans" contains the linear coordinates 
            # relatively to the map (x, y, z), while "rot" contains the rotation values expressed in 
            # quaternions (x, y, z, w).
            (trans, rot) = self.tf_listener.lookupTransform("/map", "/base_footprint", rospy.Time(0))

            # Since for the 2D navigation we only need the (x, y) coordinates, we return only the first 
            # two values of the "trans" array.
            return [trans[0], trans[1]]
        except Exception as e:
            rospy.logerr(f"Errore TF: {e}")
            return None

    def ui_callback(self, msg):
        """Handles the messages sent from the User Interface, checking whether the goal is a 
        known point of interest or if it is a set of coordinates"""

        data_str = msg.data
        rospy.loginfo(f"Ricevuto: {data_str}")

        # We use a try/except block to distinguish between the two possible type of messages received, 
        # that could be either a JSON containing the goal's coordinates or a simple string containing 
        # either a dock/undock command or a known point of interest
        try:
            # We try to retrieve the goal's coordinates from the JSON received
            coords = json.loads(data_str)
            target_x = coords['x']
            target_y = coords['y']

            # We call the path planning function with the coordinates received as parameters
            rospy.loginfo(f"Navigazione verso Coordinate -> x: {target_x}, y: {target_y}")
            self.run_smart_nav(target_x, target_y, "Selected Map Point")
            
        except (ValueError, KeyError, TypeError):

            # If we got one of these errors, it means that we received a string, so we have to check 
            # which action to perform depending on the string received (dock/undock or POI navigation)
            if data_str == "DOCK_MANUAL":
                self.execute_physical_dock()
            elif data_str == "UNDOCK_MANUAL":
                self.execute_physical_undock()
            else:
                # Check if the string received is a known point of interest, if that is the case, we 
                # call the path planning function with the POI's name and its coordinates as parameters, 
                # if not we output an error in the data received
                if data_str in self.all_checkpoints:
                    poi_data = self.all_checkpoints[data_str]
                    self.run_smart_nav(poi_data[2], poi_data[3], data_str)
                else:
                    rospy.logerr(f"POI o comando non riconosciuto: {data_str}")

    def run_smart_nav(self, x, y, target):
        """
        Computes the path to reach the final goal. It works in the same way for our two different 
        cases, with the only difference that is that if the final goal is a set of coordinates, 
        then the final step will be reached by calling the "move_base" function; otherwise, if 
        "target" is a known point of interest, it will reach it in the same way that it reached 
        the other POIs along the path.
        """

        # We fetch the checkpoints available on the map. We do this again to make sure that 
        # if they had changed from when we fetched them at the beginning of this script, we 
        # will have the most recent version.
        self.all_checkpoints = rospy.get_param("/mmap/poi/submap_0", {})

        # We make sure that the robot is well located in the map and that it has not gotten lost.
        robot_pos = self.get_robot_pose()
        if not robot_pos:
            rospy.logerr("Error: impossible to get ARI's position.")
            return

        # We exclude the points of interest of the docking station from the ones available to 
        # recalibrate ARI, since we do not need them.
        excluded_names = ["ari_16c_docked_pose", "ari_16c_dockstation"]

        # Definition of the final destination. We use the coordinates received as parameters 
        # of the function since they will work correctly both for the selection of a point in 
        # the map and for the selection of a known point of interest.
        target_pos = [x, y]
        
        # Initialization of an object that will store the starting position of ARI. We set its 
        # header to "map", that means that the coordinates that we will feed it are relative 
        # to the map (hence not relative to its position). Then, we set the x and y coordinates 
        # to the ones that we received earlier by calling the "get_robot_pose" function.
        start = PoseStamped()
        start.header.frame_id = "map"
        start.pose.position.x, start.pose.position.y = robot_pos[0], robot_pos[1]
        
        # Initialization of an object that will store the goal position that we want to reach. 
        # It works in the same exact way as the starting position, with the only difference 
        # standing in the goal's coordinates in place of the ones of the starting position.
        goal_pose = PoseStamped()
        goal_pose.header.frame_id = "map"
        goal_pose.pose.position.x, goal_pose.pose.position.y = target_pos[0], target_pos[1]
        
        # We try to compute the path plan to reach the final destination. If this action 
        # will trigger some exceptions, we will communicate them in output adn exit the 
        # function, without making the whole system crash.
        try:
            # Computation of the path which goes from the starting position and ends in 
            # the goal position. We set the tolerance to 0.1, meaning that we want to 
            # arrive at least at 0.1 metres distant from the final goal. We store then 
            # this path in a variable that we will use later.
            plan_resp = self.plan_service(start, goal_pose, 0.1)
            path = plan_resp.plan
        except rospy.ServiceException as e:
            rospy.logerr(f"Failed computation of global path plan: {e}")
            return

        # Initialization of the variable that will store the checkpoints
        sequence = []

        # We store the positions that the robot will go to in a variable. Since it would be 
        # heavy to use every estimated position that the robot will go to, we take one every 
        # 5 positions, that is still very detailed but a little more efficient.
        path_points = [(p.pose.position.x, p.pose.position.y) for p in path.poses[::5]]

        # For loop that handles the computation of the calibration points available along the 
        # path computed earlier and stores them in a variable.
        for name, data in self.all_checkpoints.items():
            # Skip the final destination and the checkpoints excluded earlier (the docking station).
            if name == target or any(excl in name.lower() for excl in excluded_names):
                continue
            
            # Store the coordinates of the POI that we are examining
            cp_x, cp_y = data[2], data[3]
            
            # Skip the checkpoints that are too close to ARI's current position, since we assume 
            # that when ARI is starting a navigation action is already well located in the map. 
            # We skip them by checking if they are 1.5 metres away from ARI's current position.
            if math.hypot(cp_x - robot_pos[0], cp_y - robot_pos[1]) < 1.5:
                continue

            # Check if the POI that we are examining is on the path of the destination. We 
            # perform this by checking if there is at least one point on the computed path that 
            # is maximum 1.5 metres away from the POI that we are analyzing. If this is the case, 
            # then we will consider this POI "on the path" and thus useful to stop to recalibrate 
            # ARI's position.
            is_on_path = any(math.hypot(cp_x - px, cp_y - py) < 1.5 for px, py in path_points)
            
            # If we found a checkpoint on the path, than we compute its distance relative to the 
            # final goal, this is useful to later sort the sequence of the checkpoints to visit 
            # them in order from the starting position.
            if is_on_path:
                dist_cp_meta = math.hypot(cp_x - target_pos[0], cp_y - target_pos[1])
                sequence.append({"name": name, "dist": dist_cp_meta})

        # Sorting of the found checkpoints. We sort them in descending order (reverse = True) 
        # since the distance used is the one from the final destination, and we need the sequence 
        # from the ones that are closer to the starting point, hence further from the destination.
        sequence.sort(key=lambda x: x["dist"], reverse=True)
        
        # Variable that stores the cleaned sequence of the checkpoints
        final_sequence = []

        # For loop that cleans the sequence of checkpoints, eliminating the checkpoints that are 
        # too close to each other (max 2 metres from each other)
        last_pos = (robot_pos[0], robot_pos[1])
        for cp in sequence:
            cp_data = self.all_checkpoints[cp["name"]]

            # Check if the selected checkpoint is too close from the one that we analyzed 
            # earlier. If that is not the case, we append it to the clean list.
            if math.hypot(cp_data[2] - last_pos[0], cp_data[3] - last_pos[1]) > 2.0:
                final_sequence.append(cp["name"])
                last_pos = (cp_data[2], cp_data[3])

        rospy.loginfo(f"Calibration sequence: {final_sequence}")

        # For loop that handles the navigation to each checkpoint in the list. We 
        # perform navigation like that because if for some reason ARI would have to 
        # re-compute the path to the final destination, then the list of checkpoints 
        # would get lost, while if we perform navigation like that, we will 
        # recalibrate ARI's position after each little step, making sure that the 
        # whole sequence won't get lost when encountering any unexpected scenario.
        for step in final_sequence:
            rospy.loginfo(f"Navigation towards ArUco checkpoint: {step}")

            # Creation and sending of an object containing the next step of the sequence
            goal = GoToFloorPOIGoal(floor=self.floor, poi=step)
            self.nav_client.send_goal(goal)

            # We block the execution and wait for the result of the previous command
            self.nav_client.wait_for_result()
            
            # Check if the previous step has been reached and, if this is the case, 
            # we stop two seconds to recalibrate the position.
            if self.nav_client.get_state() == actionlib.GoalStatus.SUCCEEDED:
                rospy.loginfo(f"{step} Reached. Recalibrating...")
                rospy.sleep(2.0)

        # Check on which case we are in: navigation to a known POI or towards some 
        # coordinates in the map
        if target in self.all_checkpoints:
            rospy.loginfo(f"Final navigation towards POI: {target}")

            # If the target is a known checkpoint, we navigate towards it like we done earlier
            final_goal = GoToFloorPOIGoal(floor=self.floor, poi=target)
            self.nav_client.send_goal(final_goal)
            self.nav_client.wait_for_result()
        else:
            # Else, the final destination is a set of coordinates in the map, so we need to 
            # handle this navigation by calling the "execute_direct_move" function and giving it in 
            # input the coordinates of the final goal.
            rospy.loginfo(f"Navigazione finale verso coordinate mappa: ({x}, {y})")
            self.execute_direct_move_base(x, y)

    def execute_direct_move_base(self, x, y):
        """
        Handles navigation to specific coordinates in the map. The orientation is 
        set by default to w=1.0, meaning that ARI will finish the navigation by 
        always facing the same direction of the x-axis of the map.
        """
        rospy.loginfo(f"Sending goal to move_base: x={x}, y={y}")
        
        # Creation of a move base object with the header set to "map", meaning that 
        # the coordinates that we will give to it will be relative to the map. We 
        # also set the stamp to the current time to make the ROS system acknowledge 
        # that we are sending a command right now, hence it is not an old command 
        # left in the queue.
        goal = MoveBaseGoal()
        goal.target_pose.header.frame_id = "map"
        goal.target_pose.header.stamp = rospy.Time.now()
        
        # Set the coordinates received by the frontend. Since they are from a 2D 
        # map, we only have the x and y coordinates, and we assume that the z 
        # coordinate is equal to 0, since ARI is moving always on the same floor.
        goal.target_pose.pose.position.x = x
        goal.target_pose.pose.position.y = y
        goal.target_pose.pose.position.z = 0.0
        
        # Set the final rotation that ARI will face at the goal. Since it is not 
        # defined by the values that we receive by the frontend, we set it by 
        # default to w=1.0, that is the direction of the x-axis of the map.
        goal.target_pose.pose.orientation.x = 0.0
        goal.target_pose.pose.orientation.y = 0.0
        goal.target_pose.pose.orientation.z = 0.0
        goal.target_pose.pose.orientation.w = 1.0
        
        # Send the just created goal to the navigation system and block 
        # the execution until we will receive a feedback.
        self.move_base_client.send_goal(goal)
        self.move_base_client.wait_for_result()
        
        # Retrieve the final state of the action sent earlier to 
        # give a feedback in output
        status = self.move_base_client.get_state()
        if status == actionlib.GoalStatus.SUCCEEDED:
            rospy.loginfo("Goal reached with success.")
        else:
            rospy.logwarn(f"Move_base failed or interrupted. State: {status}")

    def execute_physical_dock(self):
        """Procedure to execute the automatic docking"""

        # Name of the point of interest of the docking station. We use 
        # it to check if we are near to it before executing the dock action
        dock_poi_name = 'ari_16c_dockstation'
        
        if dock_poi_name not in self.all_checkpoints:
            rospy.logerr(f"Error: {dock_poi_name} does not exist.")
            return
        
        # Retrieve the current position of the robot and also check that 
        # it did not get lost.
        robot_pos = self.get_robot_pose()
        if not robot_pos: return

        # Computation of the distance between the current position and the 
        # checkpoint of the docking station
        dock_data = self.all_checkpoints[dock_poi_name]
        dock_x, dock_y = dock_data[2], dock_data[3]
        dist_to_dock = math.hypot(robot_pos[0] - dock_x, robot_pos[1] - dock_y)

        # Check if the distance just computed is greater than the safety threshold (1.5 m)
        if dist_to_dock > 1.5:
            rospy.logwarn(f"Too distantto perform dock ({dist_to_dock:.2f}m).")
            return

        # To make sure that we are correctly aligned to the docking station, we send a 
        # navigation command to exactly reach the point of interest of the docking 
        # station. This command is slightly different from the ones that we were sending 
        # before, since it does not wait for the feedback of the action, but will wait 
        # maximum 10 seconds for a result, and if the result will be an error or if 
        # there won't be any result before 10 seconds, the procedure will exit with 
        # an error status and will stop the dock action.
        rospy.loginfo("Aligning with the docking station...")
        approach_goal = GoToFloorPOIGoal(floor=self.floor, poi=dock_poi_name)
        self.nav_client.send_goal(approach_goal)
        self.nav_client.wait_for_result(rospy.Duration(10.0))

        # Start of the docking action
        rospy.loginfo(f"Distance: {dist_to_dock:.2f}m. Starting docking...")

        # Creation of a dock goal object and setting its
        # parameters to tell ARI to perform docking from the current position 
        # (use_current_pose = True) and to actually perform docking and not just get 
        # close to the station (skip_docking = False)
        dock_goal = GoAndDockGoal()
        dock_goal.use_current_pose = True
        dock_goal.skip_docking = False
        
        # Send the dock goal to perform it
        self.dock_client.send_goal(dock_goal)
        
        # Wait for the result, but check how much time it took to perform the action
        start_t = rospy.get_time()
        self.dock_client.wait_for_result()
        duration = rospy.get_time() - start_t
        
        # Check if the procedure took too little time, meaning that the docking sent 
        # a success feedback while it actually did not perform the action
        if duration < 1.0:
            rospy.logerr("ERROR: docking maneuver ended too early. Check laser alignment!")
        else:
            rospy.loginfo("Docking maneuver completed succesfully.")

    def execute_physical_undock(self):
        """Procedure to execute the undocking action"""

        rospy.loginfo("Starting undocking maneuver...")

        # Creation of an undock goal object and send it to perform the undocking action
        goal = UndockGoal()
        self.undock_client.send_goal(goal)

        # Block the execution waiting for the result
        self.undock_client.wait_for_result()

        rospy.loginfo("Undocking completed.")

if __name__ == '__main__':
    navigator = AriSmartNavigator()
    rospy.spin()