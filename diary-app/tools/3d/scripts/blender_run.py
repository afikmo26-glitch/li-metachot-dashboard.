# blender_run.py: run inside Blender (Scripting tab, or the Blender MCP execute_code). Imports assets/sim3d/dragon.glb
# into a scene "RunWork", builds a looping 'run' clip (15 frames @ 24fps) on top of idle frame 0 by turning bones
# about world axes (+x forward, +y the fighter's left, +z up), and exports the armature with only that clip to
# OUT. Then: rename its clip to 'run', retarget.mjs OUT <model>.glb tmp.glb, addclip.mjs tmp.glb run <model>.glb.
import bpy, os, tempfile
REPO = os.environ.get("DIARY_APP", r"C:\Users\אמיר\OneDrive\Documentos\li-metachot-dashboard\diary-app")
SRC = os.path.join(REPO, "assets", "sim3d", "dragon.glb")
OUT = os.path.join(tempfile.gettempdir(), "runwork", "run_donor.glb")
sc = bpy.data.scenes.get("RunWork") or bpy.data.scenes.new("RunWork")
bpy.context.window.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)

import math
from mathutils import Matrix

arm = next(o for o in sc.objects if o.type == "ARMATURE")
ad = arm.animation_data or arm.animation_data_create()
N = 15                      # 15 frames @ 24fps = 0.625 s per stride pair
sc.render.fps = 24

# idle frame 0 is the base pose
ad.action = bpy.data.actions["idle"]
sc.frame_set(0)
base = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}

def depth(b):
    return 0 if b.parent is None else 1 + depth(b.parent)
order = sorted(arm.pose.bones, key=lambda pb: depth(pb.bone))

def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)

def deltas(p):
    s, c = math.sin(p), math.cos(p)
    knee = lambda q: 18 + 80 * max(0.0, math.cos(q)) ** 1.5
    thL, thR = -38 * s - 8, 38 * s - 8
    kL, kR = knee(p), knee(p + math.pi)
    d = {
        "Waist":       [("Y", 12), ("Z", 0)],
        "Pelvis":      [("Z", -7 * s)],
        "Spine01":     [("Y", 4)],
        "Spine02":     [("Z", 10 * s)],
        "Head":        [("Y", -10), ("Z", -6 * s)],
        "L_Thigh":     [("Y", thL)],
        "R_Thigh":     [("Y", thR)],
        "L_Calf":      [("Y", kL)],
        "R_Calf":      [("Y", kR)],
        "L_Foot":      [("Y", -0.5 * (thL + kL))],
        "R_Foot":      [("Y", -0.5 * (thR + kR))],
        "L_Upperarm":  [("Y", 40 * s)],
        "R_Upperarm":  [("Y", -40 * s)],
        "L_Forearm":   [("Y", -55 - 12 * s)],
        "R_Forearm":   [("Y", -55 + 12 * s)],
    }
    return d

act = bpy.data.actions.get("run")
if act:
    bpy.data.actions.remove(act)
act = bpy.data.actions.new("run")
act.use_fake_user = True
ad.action = act
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"

for f in range(N + 1):
    p = 2 * math.pi * (f % N) / N
    sc.frame_set(f)
    for pb in arm.pose.bones:
        pb.matrix_basis = base[pb.name].copy()
    bpy.context.view_layer.update()
    d = deltas(p)
    for pb in order:
        if pb.name not in d:
            continue
        R = Matrix.Identity(4)
        for ax, deg in d[pb.name]:
            R = rot(ax, deg) @ R
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)
        if pb.name == "Hip":
            pb.keyframe_insert("location", frame=f, group=pb.name)

# make the loop seamless: the last key copies the first
fcs = [fc for L in act.layers for st in L.strips for cb in st.channelbags for fc in cb.fcurves]
for fc in fcs:
    k = fc.keyframe_points
    k[-1].co.y = k[0].co.y
    for kp in k:
        kp.interpolation = "LINEAR"
    fc.update()
sc.frame_start, sc.frame_end = 0, N
print("run keys:", len(fcs), "curves, frames", act.frame_range[:])

for o in sc.objects:
    o.select_set(o.type in ("ARMATURE", "MESH") and o.name != "Icosphere")
bpy.context.view_layer.objects.active = arm
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
    export_animations=True, export_animation_mode="ACTIVE_ACTIONS", export_force_sampling=True,
    export_frame_range=True, export_anim_single_armature=True, export_def_bones=False)
print("exported", OUT)
