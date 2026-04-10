import numpy as np

# --- TORSO PARAMETERS (848x480) ---
cx_torso = 421.9996032714844
cy_torso = 237.9039764404297
fx_torso = 616.7684936523438
fy_torso = 615.880615234375

K_TORSO = np.array([[fx_torso, 0, cx_torso], [0, fy_torso, cy_torso], [0, 0, 1]])
D_TORSO = np.array([0.0, 0.0, 0.0, 0.0, 0.0])

# ---  HEAD PARAMETERS (Sony 1280x960) ---
cx_head = 642.2582577578172
cy_head = 474.1471906434584
fx_head = 999.461170663331
fy_head = 996.9611451866272

K_HEAD = np.array([[fx_head, 0, cx_head], [0, fy_head, cy_head], [0, 0, 1]])
D_HEAD = np.array([0.1644, -0.2717, -0.0028, -0.00009, 0.0])