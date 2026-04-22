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
# # Per il docking ARI usa solitamente questo (verifica sul tuo robot):
from dock_charge_sm_msgs.msg import GoAndDockAction, GoAndDockGoal
# Aggiungi l'import per l'undock (usa rosmsg list per verificare se è laser_servoing_msgs o altro)
from laser_servoing_msgs.msg import UndockAction, UndockGoal
from move_base_msgs.msg import MoveBaseAction, MoveBaseGoal

class AriSmartNavigator:
    def __init__(self):
        rospy.init_node('smart_navigator_node')
        
        # 1. Caricamento Parametri con ATTESA
        self.floor = rospy.get_param("/current_floor", "floor_12")
        
        rospy.loginfo("In attesa del caricamento dei POI sul server dei parametri...")
        
        # Aspetta finché il parametro non esiste (timeout di 30 secondi)
        timeout = 30
        start_time = rospy.get_time()
        while not rospy.has_param("/mmap/poi/submap_0") and not rospy.is_shutdown():
            if rospy.get_time() - start_time > timeout:
                rospy.logerr("TIMEOUT: I POI non sono stati caricati in tempo!")
                break
            rospy.sleep(1.0)

        # Ora carichiamo i dati
        self.all_checkpoints = rospy.get_param("/mmap/poi/submap_0", {})
        
        if not self.all_checkpoints:
            rospy.logerr("ATTENZIONE: Lista POI vuota dopo il caricamento!")
        else:
            rospy.loginfo(f"Caricati {len(self.all_checkpoints)} POI correttamente.")

        # 2. Setup TF e Action Client
        self.tf_listener = tf.TransformListener()
        self.nav_client = actionlib.SimpleActionClient('/composite_navigation', GoToFloorPOIAction)
        
        rospy.loginfo("In attesa di /composite_navigation...")
        self.nav_client.wait_for_server()

        # 3. Servizio per il piano teorico
        rospy.wait_for_service('/move_base/make_plan')
        self.plan_service = rospy.ServiceProxy('/move_base/make_plan', GetPlan)

        # 4. Subscriber per l'interfaccia web
        rospy.Subscriber("/ui/navigation_request", String, self.ui_callback)

        # Client per l'aggancio (Docking)
        self.dock_client = actionlib.SimpleActionClient('/go_and_dock', GoAndDockAction)
        self.dock_client.wait_for_server(rospy.Duration(5.0))

        self.undock_client = actionlib.SimpleActionClient('/undocker_server', UndockAction)
        self.undock_client.wait_for_server(rospy.Duration(5.0))

        # Nel metodo __init__
        self.move_base_client = actionlib.SimpleActionClient('/move_base', MoveBaseAction)
        rospy.loginfo("In attesa di /move_base...")
        self.move_base_client.wait_for_server()
        
        rospy.loginfo("SISTEMA PRONTO: In attesa di destinazioni via POI")

    def get_robot_pose(self):
        """Ottiene x, y di ARI rispetto alla mappa"""
        try:
            self.tf_listener.waitForTransform("/map", "/base_footprint", rospy.Time(0), rospy.Duration(2.0))
            (trans, rot) = self.tf_listener.lookupTransform("/map", "/base_footprint", rospy.Time(0))
            return [trans[0], trans[1]]
        except Exception as e:
            rospy.logerr(f"Errore TF: {e}")
            return None

    def ui_callback(self, msg):
        data_str = msg.data
        rospy.loginfo(f"Ricevuto: {data_str}")

        try:
            # Proviamo a vedere se la UI ha mandato un JSON (coordinate x,y)
            coords = json.loads(data_str)
            target_x = coords['x']
            target_y = coords['y']
            rospy.loginfo(f"Navigazione verso Coordinate -> x: {target_x}, y: {target_y}")
            self.run_smart_nav(target_x, target_y, "Selected Map Point")
            
        except (ValueError, KeyError, TypeError):
            # Se non è un JSON, è un comando stringa semplice (POI o DOCK)
            if data_str == "DOCK_MANUAL":
                self.execute_physical_dock()
            elif data_str == "UNDOCK_MANUAL":
                self.execute_physical_undock()
            else:
                # È un POI memorizzato (es. "aula_1")
                if data_str in self.all_checkpoints:
                    poi_data = self.all_checkpoints[data_str]
                    self.run_smart_nav(poi_data[2], poi_data[3], data_str)
                else:
                    rospy.logerr(f"POI o comando non riconosciuto: {data_str}")

    def run_smart_nav(self, x, y, target):
        """
        Calcola il percorso verso (x, y). 
        Se 'target' è un nome di un POI noto, lo usa per la navigazione finale.
        Altrimenti usa move_base per raggiungere le coordinate precise.
        """
        self.all_checkpoints = rospy.get_param("/mmap/poi/submap_0", {})
        robot_pos = self.get_robot_pose()
        
        if not robot_pos:
            rospy.logerr("Impossibile ottenere la posa del robot via TF.")
            return

        # Lista di esclusione per punti tecnici
        excluded_names = ["ari_16c_docked_pose", "ari_16c_dockstation"]

        # A. Definizione della meta finale (target_pos)
        # Usiamo x, y passati come argomenti, che sono già corretti sia per POI che per Mappa
        target_pos = [x, y]
        
        start = PoseStamped()
        start.header.frame_id = "map"
        start.pose.position.x, start.pose.position.y = robot_pos[0], robot_pos[1]
        
        goal_pose = PoseStamped()
        goal_pose.header.frame_id = "map"
        goal_pose.pose.position.x, goal_pose.pose.position.y = target_pos[0], target_pos[1]
        
        try:
            plan_resp = self.plan_service(start, goal_pose, 0.1)
            path = plan_resp.plan
        except rospy.ServiceException as e:
            rospy.logerr(f"Fallito calcolo piano globale: {e}")
            return

        # B. Identificazione checkpoint intermedi (ArUco) lungo il path
        sequence = []
        path_points = [(p.pose.position.x, p.pose.position.y) for p in path.poses[::5]]

        for name, data in self.all_checkpoints.items():
            # Saltiamo il target (se è un POI) e i punti di docking
            if name == target or any(excl in name.lower() for excl in excluded_names):
                continue
            
            cp_x, cp_y = data[2], data[3]
            
            # 1. Filtro prossimità attuale
            if math.hypot(cp_x - robot_pos[0], cp_y - robot_pos[1]) < 1.5:
                continue

            # 2. Verifica se il checkpoint è vicino al percorso calcolato
            is_on_path = any(math.hypot(cp_x - px, cp_y - py) < 1.5 for px, py in path_points)
            
            if is_on_path:
                dist_cp_meta = math.hypot(cp_x - target_pos[0], cp_y - target_pos[1])
                sequence.append({"name": name, "dist": dist_cp_meta})

        # Ordina per distanza dalla meta (decrescente per l'ordine di marcia)
        sequence.sort(key=lambda x: x["dist"], reverse=True)
        
        # Pulizia checkpoint troppo vicini tra loro
        final_sequence = []
        last_pos = (robot_pos[0], robot_pos[1])
        for cp in sequence:
            cp_data = self.all_checkpoints[cp["name"]]
            if math.hypot(cp_data[2] - last_pos[0], cp_data[3] - last_pos[1]) > 2.0:
                final_sequence.append(cp["name"])
                last_pos = (cp_data[2], cp_data[3])

        rospy.loginfo(f"Sequenza di calibrazione: {final_sequence}")

        # C. Esecuzione sequenziale
        # 1. Navigazione tra i checkpoint intermedi
        for step in final_sequence:
            rospy.loginfo(f"Navigazione verso checkpoint ArUco: {step}")
            goal = GoToFloorPOIGoal(floor=self.floor, poi=step)
            self.nav_client.send_goal(goal)
            self.nav_client.wait_for_result()
            
            if self.nav_client.get_state() == actionlib.GoalStatus.SUCCEEDED:
                rospy.loginfo(f"Raggiunto {step}. Calibrazione in corso...")
                rospy.sleep(2.0) # Finestra per lo script di ricalibrazione in background

        # 2. Navigazione verso la meta finale
        if target in self.all_checkpoints:
            # È un POI registrato, usiamo composite_navigation
            rospy.loginfo(f"Navigazione finale verso POI: {target}")
            final_goal = GoToFloorPOIGoal(floor=self.floor, poi=target)
            self.nav_client.send_goal(final_goal)
            self.nav_client.wait_for_result()
        else:
            # È un punto della mappa, usiamo move_base direttamente via coordinate
            rospy.loginfo(f"Navigazione finale verso coordinate mappa: ({x}, {y})")
            self.execute_direct_move_base(x, y)

    def execute_direct_move_base(self, x, y):
        """
        Invia ARI a coordinate specifiche usando move_base.
        L'orientamento (w) è impostato a 1.0 (ARI guarderà dritto rispetto alla mappa).
        """
        rospy.loginfo(f"Invio goal a move_base: x={x}, y={y}")
        
        goal = MoveBaseGoal()
        goal.target_pose.header.frame_id = "map"
        goal.target_pose.header.stamp = rospy.Time.now()
        
        # Posizione
        goal.target_pose.pose.position.x = x
        goal.target_pose.pose.position.y = y
        goal.target_pose.pose.position.z = 0.0
        
        # Orientamento (Quaternione neutrale: ARI non ruota in modo specifico all'arrivo)
        goal.target_pose.pose.orientation.x = 0.0
        goal.target_pose.pose.orientation.y = 0.0
        goal.target_pose.pose.orientation.z = 0.0
        goal.target_pose.pose.orientation.w = 1.0
        
        self.move_base_client.send_goal(goal)
        self.move_base_client.wait_for_result()
        
        status = self.move_base_client.get_state()
        if status == actionlib.GoalStatus.SUCCEEDED:
            rospy.loginfo("Raggiunto punto libero sulla mappa con successo.")
        else:
            rospy.logwarn(f"Move_base fallito o interrotto. Stato: {status}")

    def execute_physical_dock(self):
        """Verifica posizione e orientamento prima di agganciare"""
        dock_poi_name = 'ari_16c_dockstation'
        
        if dock_poi_name not in self.all_checkpoints:
            rospy.logerr(f"Errore: {dock_poi_name} non esiste.")
            return

        robot_pos = self.get_robot_pose()
        if not robot_pos: return

        # 1. Controllo Distanza
        dock_data = self.all_checkpoints[dock_poi_name]
        dock_x, dock_y = dock_data[2], dock_data[3]
        dist_to_dock = math.hypot(robot_pos[0] - dock_x, robot_pos[1] - dock_y)

        if dist_to_dock > 1.5:
            rospy.logwarn(f"Troppo lontano ({dist_to_dock:.2f}m).")
            return

        # 2. Rotazione forzata verso la stazione
        # Prima di fare il docking, ARI deve essere allineato. 
        # Mandiamo un comando di navigazione veloce al POI della dockstation 
        # per essere certi che l'orientamento sia perfetto.
        rospy.loginfo("Allineamento finale alla dockstation...")
        approach_goal = GoToFloorPOIGoal(floor=self.floor, poi=dock_poi_name)
        self.nav_client.send_goal(approach_goal)
        self.nav_client.wait_for_result(rospy.Duration(10.0))

        # 3. Avvio Docking Fisico
        rospy.loginfo(f"Distanza: {dist_to_dock:.2f}m. Avvio aggancio fisico...")
        
        dock_goal = GoAndDockGoal()
        # In alcune versioni di ARI, bisogna specificare se usare il re-routing
        # Prova a lasciare vuoto, se fallisce ancora, aggiungi attributi se previsti dal msg
        dock_goal.use_current_pose = True
        dock_goal.skip_docking = False
        
        self.dock_client.send_goal(dock_goal)
        
        # Aspettiamo il risultato, ma monitoriamo se finisce troppo presto
        start_t = rospy.get_time()
        self.dock_client.wait_for_result()
        duration = rospy.get_time() - start_t
        
        if duration < 1.0:
            rospy.logerr("ERRORE: La manovra di docking è terminata troppo velocemente. Verificare allineamento laser!")
        else:
            rospy.loginfo("Manovra di docking completata con successo.")

    def execute_physical_undock(self):
        rospy.loginfo("Avvio manovra di sgancio (Undocking)...")
        goal = UndockGoal()
        self.undock_client.send_goal(goal)
        self.undock_client.wait_for_result()
        rospy.loginfo("Sgancio completato.")

if __name__ == '__main__':
    navigator = AriSmartNavigator()
    rospy.spin()